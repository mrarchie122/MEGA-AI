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
    this.restoreSweepTimer = null
    this.recoveryQueue = []
    this.recoveryInFlight = 0
    this.maxRecoveryConcurrency = Math.max(1, Number(process.env.SESSION_RECOVERY_MAX_CONCURRENCY || 3))
    this.minRecoveryGapMs = Math.max(15000, Number(process.env.SESSION_RECOVERY_MIN_GAP_MS || 60000))

    fs.mkdirSync(this.sessionsRoot, { recursive: true })
    this.#hydrateFromDisk()
    this.#startRestoreSweep()
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
        recoveryPending: false,
        recoveryQueued: false,
        lastRecoveryAt: 0,
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
    const sessionDir = path.dirname(authDir)

    if (options.resetAuth === true) {
      fs.rmSync(sessionDir, { recursive: true, force: true })
    }

    fs.mkdirSync(authDir, { recursive: true })

    // Migrate legacy sessions where creds/key json files were stored directly in session root.
    const legacyCredsPath = path.join(sessionDir, 'creds.json')
    const authCredsPath = path.join(authDir, 'creds.json')
    if (!fs.existsSync(authCredsPath) && fs.existsSync(legacyCredsPath)) {
      const legacyFiles = fs.readdirSync(sessionDir)
      for (const file of legacyFiles) {
        if (!file.endsWith('.json')) continue
        if (file === 'database.json') continue

        const from = path.join(sessionDir, file)
        const to = path.join(authDir, file)
        if (!fs.existsSync(from) || fs.existsSync(to)) continue

        try {
          fs.renameSync(from, to)
        } catch {
          try {
            fs.copyFileSync(from, to)
            fs.unlinkSync(from)
          } catch {
            // ignore migrate failures for individual files
          }
        }
      }
    }

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
      recoveryPending: false,
      recoveryQueued: false,
      lastRecoveryAt: 0,
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
    state.lastStartAt = Date.now()

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
          if (/MessageCounterError: Key used already or never filled/i.test(line) && state.status !== 'running') {
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
      const wasLoggedOutBeforeExit = state.status === 'logged_out'
      const isRestart = (code === 101 || code === 102) && state.status !== 'stopping' && !wasLoggedOutBeforeExit

      // Track consecutive failures to break infinite loops
      if (isRestart) {
        state.restartCount = (state.restartCount || 0) + 1
      } else {
        state.restartCount = 0
      }

      const tooManyRestarts = state.restartCount > Math.max(6, Number(process.env.SESSION_MAX_RESTARTS || 12))

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

  #getStallMs() {
    return Math.max(
      15000,
      Number(process.env.SESSION_RESTORE_STALL_MS || process.env.SESSION_RECONNECT_STALL_MS || 45000)
    )
  }

  #isTransientStatus(status) {
    return ['starting', 'connecting', 'reconnecting', 'pairing'].includes(String(status || '').toLowerCase())
  }

  #enqueueRecovery(state, reason) {
    if (!state || state.recoveryPending || state.recoveryQueued) return

    const now = Date.now()
    if (state.lastRecoveryAt && now - state.lastRecoveryAt < this.minRecoveryGapMs) {
      return
    }

    state.recoveryQueued = true
    this.recoveryQueue.push({ sessionId: state.sessionId, reason })
    this.#drainRecoveryQueue()
  }

  #drainRecoveryQueue() {
    while (this.recoveryInFlight < this.maxRecoveryConcurrency && this.recoveryQueue.length > 0) {
      const item = this.recoveryQueue.shift()
      if (!item) continue

      const state = this.sessions.get(item.sessionId)
      if (!state) continue

      state.recoveryQueued = false
      this.recoveryInFlight += 1

      void this.#restartStalledSession(state, item.reason).finally(() => {
        this.recoveryInFlight = Math.max(0, this.recoveryInFlight - 1)
        this.#drainRecoveryQueue()
      })
    }
  }

  async #restartStalledSession(state, reason) {
    if (!state || state.recoveryPending) return

    const now = Date.now()
    if (state.lastRecoveryAt && now - state.lastRecoveryAt < this.minRecoveryGapMs) {
      return
    }

    state.recoveryPending = true
    state.lastRecoveryAt = now

    try {
      console.log(`[manager:${state.sessionId}] ${reason}; restarting worker`)
      await this.startSession(state.sessionId, {
        phoneNumber: state.phoneNumber || '',
        pairing: state.pairing ?? false,
        resetAuth: false,
        forceRestart: true,
      })
    } catch (err) {
      state.lastError = err.message
      state.status = 'crashed'
      state.updatedAt = new Date().toISOString()
      this.emit('session.update', this.#serializeSession(state))
    } finally {
      state.recoveryPending = false
    }
  }

  #startRestoreSweep() {
    if (this.restoreSweepTimer) return
    const sweepMs = Math.max(10000, Number(process.env.SESSION_RESTORE_SWEEP_MS || 15000))

    this.restoreSweepTimer = setInterval(() => {
      const stallMs = this.#getStallMs()
      for (const state of this.sessions.values()) {
        const status = String(state.status || '').toLowerCase()
        if (!this.#isTransientStatus(status)) continue
        if (status === 'logged_out' || status === 'stopped') continue

        const updatedAt = Date.parse(state.updatedAt || '')
        const stalledFor = Number.isFinite(updatedAt) ? Date.now() - updatedAt : stallMs
        if (stalledFor < stallMs) continue

        this.#enqueueRecovery(state, `Restore sweep found ${status} session stalled for ${stalledFor}ms`)
      }
    }, sweepMs)

    if (typeof this.restoreSweepTimer.unref === 'function') {
      this.restoreSweepTimer.unref()
    }
  }

  #scheduleReconnectWatch(state) {
    if (state.reconnectTimer || state.status !== 'reconnecting') return
    const reconnectStallMs = this.#getStallMs()
    state.reconnectSince = state.reconnectSince || Date.now()
    state.reconnectTimer = setTimeout(async () => {
      state.reconnectTimer = null
      const current = this.sessions.get(state.sessionId)
      if (!current || current.status !== 'reconnecting' || !current.worker) return
      const stalledFor = Date.now() - (current.reconnectSince || Date.now())
      if (stalledFor < reconnectStallMs) return
      this.#enqueueRecovery(current, `Reconnect stalled for ${stalledFor}ms`)
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
      // Reset failure counter and stale error once a session is healthy again
      if (msg.status === 'running') {
        state.restartCount = 0
        state.lastError = null
      }
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
      if (/MessageCounterError|Key used already or never filled/i.test(errMsg) && state.status !== 'running') {
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
      this.emit('session.update', this.#serializeSession(state))
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







