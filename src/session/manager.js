import { EventEmitter } from 'events'
import { fork } from 'child_process'
import fs from 'fs'
import path from 'path'
import qrcode from 'qrcode'

const isValidSessionId = sessionId => /^[a-zA-Z0-9_-]{3,64}$/.test(sessionId)

export class SessionManager extends EventEmitter {
  constructor({ projectRoot, sessionsRoot, workerPath, baseEnv = {} }) {
    super()
    this.projectRoot = projectRoot
    this.sessionsRoot = sessionsRoot
    this.workerPath = workerPath
    this.baseEnv = baseEnv
    this.sessions = new Map()

    fs.mkdirSync(this.sessionsRoot, { recursive: true })
    this.#hydrateFromDisk()
  }

  #hydrateFromDisk() {
    const entries = fs.readdirSync(this.sessionsRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const sessionId = entry.name
      if (!isValidSessionId(sessionId)) continue
      this.sessions.set(sessionId, {
        sessionId,
        status: 'stopped',
        phoneNumber: null,
        pairingCode: null,
        qr: null,
        qrDataUrl: null,
        jid: null,
        authDir: this.getAuthDir(sessionId),
        worker: null,
        reconnectTimer: null,
        reconnectSince: null,
        lastError: null,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  getAuthDir(sessionId) {
    return path.join(this.sessionsRoot, sessionId, 'auth')
  }

  listSessions() {
    return Array.from(this.sessions.values()).map(s => this.#serializeSession(s))
  }

  getSession(sessionId) {
    const state = this.sessions.get(sessionId)
    if (!state) return null
    return this.#serializeSession(state)
  }

  #serializeSession(state) {
    return {
      sessionId: state.sessionId,
      status: state.status,
      phoneNumber: state.phoneNumber,
      pairing: state.pairing ?? null,
      pairingCode: state.pairingCode,
      qr: state.qr,
      qrDataUrl: state.qrDataUrl,
      jid: state.jid,
      authDir: state.authDir,
      lastError: state.lastError,
      updatedAt: state.updatedAt,
      pid: state.worker?.pid ?? null,
    }
  }

  async startSession(sessionId, options = {}) {
    if (!isValidSessionId(sessionId)) {
      throw new Error('Invalid sessionId. Use 3-64 chars: letters, numbers, _ or -')
    }

    const existing = this.sessions.get(sessionId)
    const forceRestart = options.forceRestart === true
    if (existing?.worker && existing.status !== 'crashed' && existing.status !== 'stopped') {
      if (!forceRestart) {
        const requestedPairing = options.pairing === undefined ? (existing.pairing ?? true) : Boolean(options.pairing)
        const requestedPhone = options.phoneNumber === undefined ? (existing.phoneNumber || '') : String(options.phoneNumber || '')
        const currentPairing = existing.pairing ?? true
        const currentPhone = existing.phoneNumber || ''

        if (requestedPairing === currentPairing && requestedPhone === currentPhone) {
          return this.#serializeSession(existing)
        }
      }

      await this.stopSession(sessionId)
    }

    if (existing?.worker && existing.status === 'crashed') {
      try {
        existing.worker.kill('SIGKILL')
      } catch {
        // ignore stale worker shutdown errors
      }
      existing.worker = null
    }

    const authDir = this.getAuthDir(sessionId)
    if (options.resetAuth === true) {
      fs.rmSync(path.dirname(authDir), { recursive: true, force: true })
    }
    fs.mkdirSync(authDir, { recursive: true })

    const state = existing || {
      sessionId,
      status: 'starting',
      phoneNumber: null,
      pairing: true,
      pairingCode: null,
      qr: null,
      qrDataUrl: null,
      jid: null,
      authDir,
      worker: null,
      lastError: null,
      updatedAt: new Date().toISOString(),
    }

    state.status = 'starting'
    state.phoneNumber = options.phoneNumber || state.phoneNumber || null
    state.pairing = Boolean(options.pairing ?? state.pairing ?? true) // default Pair Code
    state.pairingCode = null
    state.qr = null
    state.qrDataUrl = null
    state.lastError = null
    state.restartCount = (options.resetAuth ? 0 : (state.restartCount || 0)) // reset count on auth reset
    state.updatedAt = new Date().toISOString()

    const workerEnv = {
      ...process.env,
      ...this.baseEnv,
      SESSION_ID: sessionId,
      SESSION_AUTH_DIR: authDir,
      SESSION_PAIRING: String(state.pairing),
      SESSION_PHONE_NUMBER: options.phoneNumber || '',
      SESSION_DISPLAY_NAME: options.displayName || sessionId,
    }

    const worker = fork(this.workerPath, [], {
      cwd: this.projectRoot,
      env: workerEnv,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })

    state.worker = worker
    this.sessions.set(sessionId, state)

    worker.on('message', msg => {
      if (!msg || typeof msg !== 'object') return
      this.#handleWorkerMessage(state, msg)
    })

    const pipeWorkerStream = (stream, label) => {
      if (!stream) return
      stream.on('data', chunk => {
        const text = String(chunk || '').trim()
        if (!text) return
        for (const line of text.split(/\r?\n/)) {
          if (/MessageCounterError: Key used already or never filled/i.test(line)) {
            state.status = 'logged_out'
            state.lastError = 'MessageCounterError: Key used already or never filled'
            state.updatedAt = new Date().toISOString()
            this.emit('session.update', this.#serializeSession(state))
            continue
          }
          if (/Opening handshake has timed out|Bad MAC|Failed to decrypt message with any known session|Session error:Error: Bad MAC|libsignal\/src\/crypto\.js|libsignal\/src\/session_cipher\.js|libsignal\/src\/queue_job\.js|node:internal\/process\/task_queues|_asyncQueueExecutor|Closing open session in favor of incoming prekey bundle|Closing session: SessionEntry|registrationId:|currentRatchet:|indexInfo:|ephemeralKeyPair:|lastRemoteEphemeralKey:|remoteIdentityKey:|rootKey:|baseKey:|pubKey:|privKey:/i.test(line)) continue
          const msg = `[${label}] ${line}`
          console.log(`[worker:${state.sessionId}] ${msg}`)
          this.emit('session.log', { sessionId: state.sessionId, message: msg })
        }
      })
    }

    pipeWorkerStream(worker.stdout, 'stdout')
    pipeWorkerStream(worker.stderr, 'stderr')

    worker.on('exit', (code, signal) => {
      state.worker = null
      this.#clearReconnectWatch(state)
      const shouldResetAuth = code === 102
      const isClean = code === 0
      const isLoggedOut = code === 103
      const isRestart = (code === 101 || code === 102) && state.status !== 'stopping'

      // Track consecutive failures to break infinite loops
      if (isRestart) {
        state.restartCount = (state.restartCount || 0) + 1
      } else {
        state.restartCount = 0
      }

      const tooManyRestarts = state.restartCount > 60

      state.status = state.status === 'stopping'
        ? 'stopped'
        : isLoggedOut
          ? 'logged_out'
        : tooManyRestarts
          ? 'crashed'
          : isRestart ? 'reconnecting' : 'crashed'

      state.updatedAt = new Date().toISOString()
      if (isLoggedOut) {
        state.lastError = 'WhatsApp logged out. Start session again to relink.'
      } else if (code !== 0 && code !== null) {
        state.lastError = tooManyRestarts
          ? `Session gave up after ${state.restartCount} restart attempts`
          : `worker exited with code ${code}`
      } else if (signal) {
        state.lastError = `worker exited by signal ${signal}`
      }
      this.emit('session.update', this.#serializeSession(state))

      if (isRestart && !tooManyRestarts) {
        const delay = Math.min(2000 * state.restartCount, 10000) // backoff: 2s, 4s, 6s…
        setTimeout(() => {
          this.startSession(sessionId, {
            phoneNumber: state.phoneNumber || '',
            pairing: state.pairing ?? false,
            resetAuth: shouldResetAuth,
          }).catch(err => {
            state.lastError = err.message
            state.status = 'crashed'
            state.updatedAt = new Date().toISOString()
            this.emit('session.update', this.#serializeSession(state))
          })
        }, delay)
      } else if (tooManyRestarts) {
        console.error(`[manager:${sessionId}] Too many restarts (${state.restartCount}), stopping.`)
      }
    })

    worker.on('error', err => {
      state.lastError = err.message
      state.status = 'crashed'
      this.#clearReconnectWatch(state)
      state.updatedAt = new Date().toISOString()
      this.emit('session.update', this.#serializeSession(state))
    })

    this.emit('session.update', this.#serializeSession(state))
    return this.#serializeSession(state)
  }

  #clearReconnectWatch(state) {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer)
      state.reconnectTimer = null
    }
    state.reconnectSince = null
  }

  #scheduleReconnectWatch(state) {
    if (state.reconnectTimer || state.status !== 'reconnecting') return
    const reconnectStallMs = Math.max(15000, Number(process.env.SESSION_RECONNECT_STALL_MS || 45000))
    state.reconnectSince = state.reconnectSince || Date.now()
    state.reconnectTimer = setTimeout(async () => {
      state.reconnectTimer = null
      const current = this.sessions.get(state.sessionId)
      if (!current || current.status !== 'reconnecting' || !current.worker) return
      const stalledFor = Date.now() - (current.reconnectSince || Date.now())
      if (stalledFor < reconnectStallMs) return
      console.log(`[manager:${state.sessionId}] Reconnect stalled for ${stalledFor}ms; restarting worker`)
      try {
        await this.startSession(state.sessionId, {
          phoneNumber: current.phoneNumber || '',
          pairing: current.pairing ?? false,
          resetAuth: false,
          forceRestart: true,
        })
      } catch (err) {
        current.lastError = err.message
        current.status = 'crashed'
        current.updatedAt = new Date().toISOString()
        this.emit('session.update', this.#serializeSession(current))
      }
    }, reconnectStallMs)
  }

  #handleWorkerMessage(state, msg) {
    if (msg.type === 'log') {
      if (typeof msg.message === 'string' && msg.message.trim()) {
        console.log(`[worker:${state.sessionId}] ${msg.message}`)
        this.emit('session.log', { sessionId: state.sessionId, message: msg.message })
      }
      return
    }

    if (msg.type === 'status') {
      if (state.pairingCode && (msg.status === 'logged_out' || msg.status === 'reconnecting')) {
        state.status = 'pairing'
      } else {
        state.status = msg.status || state.status
      }
      if (msg.status === 'running' || msg.status === 'logged_out' || msg.status === 'crashed' || msg.status === 'stopped') {
        this.#clearReconnectWatch(state)
      }
      if (msg.status === 'reconnecting') {
        this.#scheduleReconnectWatch(state)
      }
      // Reset failure counter on successful connection
      if (msg.status === 'running') state.restartCount = 0
      state.updatedAt = new Date().toISOString()
      if (msg.jid) state.jid = msg.jid
      if (msg.error && !(state.pairingCode && msg.status === 'logged_out')) state.lastError = msg.error
      this.emit('session.update', this.#serializeSession(state))
      return
    }

    if (msg.type === 'pairing') {
      state.pairingCode = msg.code || null
      state.qr = null
      state.qrDataUrl = null
      state.status = 'pairing'
      state.updatedAt = new Date().toISOString()
      this.emit('session.update', this.#serializeSession(state))
      return
    }

    if (msg.type === 'qr') {
      if (state.pairingCode) return
      state.qr = msg.qr || null
      state.updatedAt = new Date().toISOString()
      qrcode
        .toDataURL(msg.qr)
        .then(dataUrl => {
          state.qrDataUrl = dataUrl
          state.updatedAt = new Date().toISOString()
          this.emit('session.update', this.#serializeSession(state))
        })
        .catch(() => {
          this.emit('session.update', this.#serializeSession(state))
        })
      return
    }

    if (msg.type === 'error') {
      const errMsg = msg.error || 'unknown worker error'
      state.lastError = errMsg
      if (/MessageCounterError|Key used already or never filled/i.test(errMsg)) {
        state.status = 'logged_out'
      }
      state.updatedAt = new Date().toISOString()
      this.emit('session.update', this.#serializeSession(state))
    }
  }

  async stopSession(sessionId) {
    const state = this.sessions.get(sessionId)
    if (!state) throw new Error('Session not found')

    if (!state.worker) {
      state.status = 'stopped'
      state.updatedAt = new Date().toISOString()
      return this.#serializeSession(state)
    }

    state.status = 'stopping'
    this.#clearReconnectWatch(state)
    state.updatedAt = new Date().toISOString()
    this.emit('session.update', this.#serializeSession(state))

    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        if (state.worker) state.worker.kill('SIGKILL')
      }, 8000)

      state.worker.once('exit', () => {
        clearTimeout(timeout)
        resolve(true)
      })

      try {
        state.worker.send({ type: 'stop' })
      } catch {
        if (state.worker) state.worker.kill('SIGTERM')
      }
    })

    state.status = 'stopped'
    state.worker = null
    state.updatedAt = new Date().toISOString()
    this.emit('session.update', this.#serializeSession(state))
    return this.#serializeSession(state)
  }

  async deleteSession(sessionId) {
    const state = this.sessions.get(sessionId)
    if (!state) throw new Error('Session not found')

    if (state.worker) await this.stopSession(sessionId)

    const sessionDir = path.join(this.sessionsRoot, sessionId)
    fs.rmSync(sessionDir, { recursive: true, force: true })
    this.sessions.delete(sessionId)
    this.emit('session.delete', { sessionId })
    return { sessionId, deleted: true }
  }
}







