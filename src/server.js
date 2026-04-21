import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import express from 'express'

import { SessionManager } from './session/manager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

process.env.BOTNAME = process.env.BOTNAME || 'ARCHIE-MD-WEB-BOT'
process.env.OWNER_NAME = process.env.OWNER_NAME || 'ARCHIE TECH NEXUS'

const PORT = Number(process.env.PORT || 3015)
const DEFAULT_SESSION_ID = process.env.SESSION_ID?.trim() || 'primary'
const app = express()

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(
  '/assets',
  express.static(path.join(projectRoot, 'assets'), {
    etag: false,
    maxAge: 0,
    setHeaders: res => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    },
  })
)

const sessionManager = new SessionManager({
  projectRoot,
  sessionsRoot: path.join(projectRoot, 'sessions'),
  workerPath: path.join(projectRoot, 'src', 'session', 'worker.js'),
  baseEnv: {
    BOTNAME: process.env.BOTNAME,
    OWNER_NAME: process.env.OWNER_NAME,
  },
})

const sseClients = new Set()

function broadcastSseEvent(event) {
  const message = `data: ${JSON.stringify(event)}\n\n`
  for (const client of sseClients) {
    try {
      if (client.destroyed || client.writableEnded) {
        sseClients.delete(client)
        continue
      }
      client.write(message)
    } catch {
      sseClients.delete(client)
      try {
        client.end()
      } catch {
        // ignore client close failures
      }
    }
  }
}

sessionManager.on('session.update', payload => {
  broadcastSseEvent({ type: 'session.update', payload })
})

sessionManager.on('session.delete', payload => {
  broadcastSseEvent({ type: 'session.delete', payload })
})

sessionManager.on('session.log', payload => {
  broadcastSseEvent({ type: 'session.log', payload })
})

app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.sendFile(path.join(projectRoot, 'assets', 'admin.html'))
})

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ARCHIE-MD-WEB-BOT',
    owner: process.env.OWNER_NAME,
    port: PORT,
    uptime: process.uptime(),
    sessions: sessionManager.listSessions().length,
  })
})

app.get('/api/config', (_req, res) => {
  res.json({
    botName: process.env.BOTNAME,
    ownerName: process.env.OWNER_NAME,
    port: PORT,
  })
})

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  sseClients.add(res)
  res.write(`data: ${JSON.stringify({ type: 'connected', payload: { now: Date.now() } })}\n\n`)

  req.on('close', () => {
    sseClients.delete(res)
  })
})

app.get('/api/sessions', (_req, res) => {
  res.json({ sessions: sessionManager.listSessions() })
})

app.get('/api/sessions/:sessionId', (req, res) => {
  const session = sessionManager.getSession(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  return res.json(session)
})

app.post('/api/sessions', async (req, res) => {
  try {
    const sessionId = String(req.body.sessionId || DEFAULT_SESSION_ID).trim()
    const phoneNumber = String(req.body.phoneNumber || "").trim()
    const authDir = path.join(projectRoot, "sessions", sessionId, "auth")
    const credsPath = path.join(authDir, "creds.json")
    const hasCreds = fs.existsSync(credsPath)
    const pairing = req.body.pairing === undefined
      ? !hasCreds
      : req.body.pairing === true || req.body.pairing === "true"
    const explicitReset = req.body.resetAuth === true || req.body.resetAuth === "true"
    const resetAuth = explicitReset || (pairing && phoneNumber.length > 0)

    const session = await sessionManager.startSession(sessionId, {
      phoneNumber,
      pairing,
      resetAuth,
    })
    return res.status(201).json(session)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
})

app.post("/api/sessions/:sessionId/start", async (req, res) => {
  try {
    const sessionId = req.params.sessionId
    const phoneNumber = String(req.body.phoneNumber || "").trim()
    const authDir = path.join(projectRoot, "sessions", sessionId, "auth")
    const credsPath = path.join(authDir, "creds.json")
    const hasCreds = fs.existsSync(credsPath)
    const pairing = req.body.pairing === undefined
      ? !hasCreds
      : req.body.pairing === true || req.body.pairing === "true"
    const explicitReset = req.body.resetAuth === true || req.body.resetAuth === "true"
    const resetAuth = explicitReset || (pairing && phoneNumber.length > 0)

    const session = await sessionManager.startSession(sessionId, {
      phoneNumber,
      pairing,
      resetAuth,
    })
    return res.json(session)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
})

app.post("/api/sessions/:sessionId/stop", async (req, res) => {
  try {
    const session = await sessionManager.stopSession(req.params.sessionId)
    return res.json(session)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
})

app.delete("/api/sessions/:sessionId", async (req, res) => {
  try {
    const result = await sessionManager.deleteSession(req.params.sessionId)
    return res.json(result)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
})

// Handle malformed JSON payloads without noisy stack traces.
app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' })
  }
  return next(err)
})

const server = app.listen(PORT, () => {
  console.log(`ARCHIE-MD-WEB-BOT manager running on port ${PORT}`)
})

process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err)
})

setImmediate(async () => {
  try {
    const readNumber = (key, fallback) => {
      const parsed = Number(process.env[key])
      return Number.isFinite(parsed) ? parsed : fallback
    }

    const restoreMinConcurrency = Math.max(1, readNumber('SESSION_RESTORE_CONCURRENCY', 1))
    const restoreMaxConcurrency = Math.max(
      restoreMinConcurrency,
      readNumber('SESSION_RESTORE_MAX_CONCURRENCY', Math.min(3, restoreMinConcurrency + 1))
    )
    const restoreKickDelayMs = Math.max(500, readNumber('SESSION_RESTORE_KICK_DELAY_MS', 1000))
    const restoreSettleMs = Math.max(15000, readNumber('SESSION_RESTORE_SETTLE_MS', 20000))
    const restorePollMs = Math.max(500, readNumber('SESSION_RESTORE_POLL_MS', 1000))
    const restoreMaxAttempts = Math.max(1, readNumber('SESSION_RESTORE_MAX_ATTEMPTS', 2))
    const restoreRetryDelayMs = Math.max(1000, readNumber('SESSION_RESTORE_RETRY_DELAY_MS', 3000))
    const restoreMaxTransient = Math.max(
      restoreMaxConcurrency,
      readNumber('SESSION_RESTORE_MAX_TRANSIENT', restoreMaxConcurrency + 1)
    )

    // Find all sessions with existing credentials
    const sessionsDir = path.join(projectRoot, 'sessions')
    fs.mkdirSync(sessionsDir, { recursive: true })
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true })
    const existingSessionIds = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const authCredsPath = path.join(sessionsDir, entry.name, 'auth', 'creds.json')
      const legacyCredsPath = path.join(sessionsDir, entry.name, 'creds.json')
      if (fs.existsSync(authCredsPath) || fs.existsSync(legacyCredsPath)) {
        existingSessionIds.push(entry.name)
      }
    }

    existingSessionIds.sort()

    if (existingSessionIds.length > 0) {
      console.log(
        `Auto-starting ${existingSessionIds.length} session(s) with existing creds: ${existingSessionIds.join(', ')}`
      )
      console.log(
        `Session restore pacing: ${restoreMinConcurrency}-${restoreMaxConcurrency} concurrent worker(s), settle timeout ${restoreSettleMs}ms, queue tick ${restoreKickDelayMs}ms, max attempts ${restoreMaxAttempts}`
      )

      const transientStatuses = new Set(['starting', 'connecting', 'reconnecting', 'pairing'])
      const pendingRestoreJobs = existingSessionIds.map(sessionId => ({
        sessionId,
        attempt: 1,
        readyAt: Date.now(),
      }))
      const activeSessionIds = new Set()
      let currentConcurrency = restoreMinConcurrency
      const restoreStats = {
        startedAttempts: 0,
        retried: 0,
        running: 0,
        loggedOut: 0,
        deferred: 0,
        failed: 0,
        skippedActive: 0,
      }

      const isTransientStatus = status => transientStatuses.has(String(status || '').toLowerCase())

      const getTransientCount = () => {
        return sessionManager
          .listSessions()
          .reduce((count, session) => count + (isTransientStatus(session.status) ? 1 : 0), 0)
      }

      const adjustConcurrency = (delta, reason) => {
        const next = Math.min(
          restoreMaxConcurrency,
          Math.max(restoreMinConcurrency, currentConcurrency + delta)
        )
        if (next === currentConcurrency) return
        currentConcurrency = next
        console.log(`Adjusted restore concurrency to ${currentConcurrency} (${reason})`)
      }

      const waitForSessionToSettle = async sessionId => {
        const deadline = Date.now() + restoreSettleMs
        while (Date.now() < deadline) {
          const current = sessionManager.getSession(sessionId)
          const status = String(current?.status || '').toLowerCase()
          if (!isTransientStatus(status)) {
            return { session: current, status, timedOut: false }
          }
          await new Promise(resolve => setTimeout(resolve, restorePollMs))
        }

        const stalled = sessionManager.getSession(sessionId)
        const stalledStatus = String(stalled?.status || '').toLowerCase()
        return { session: stalled, status: stalledStatus, timedOut: true }
      }

      const queueRetry = (sessionId, attempt, reason) => {
        if (attempt >= restoreMaxAttempts) return false
        const nextAttempt = attempt + 1
        pendingRestoreJobs.push({
          sessionId,
          attempt: nextAttempt,
          readyAt: Date.now() + restoreRetryDelayMs * attempt,
        })
        restoreStats.retried += 1
        console.warn(`Session ${sessionId} ${reason}; queued retry ${nextAttempt}/${restoreMaxAttempts}`)
        return true
      }

      const handleRestoreOutcome = async (sessionId, attempt, settleResult) => {
        const status = String(settleResult?.status || '').toLowerCase()
        const timedOut = settleResult?.timedOut === true

        if (status === 'running') {
          restoreStats.running += 1
          adjustConcurrency(1, 'successful restores')
          return
        }

        if (status === 'logged_out') {
          restoreStats.loggedOut += 1
          return
        }

        if (timedOut && isTransientStatus(status)) {
          const queued = queueRetry(sessionId, attempt, `stalled in ${status}`)
          if (queued) {
            try {
              await sessionManager.stopSession(sessionId)
            } catch {
              // ignore stop failures while re-queueing
            }
            adjustConcurrency(-1, 'stalled sessions')
            return
          }

          restoreStats.deferred += 1
          console.warn(
            `Session ${sessionId} remained ${status} after ${attempt} attempt(s); leaving worker active for background recovery sweep`
          )
          return
        }

        if (status === 'stopped' || status === 'crashed') {
          if (queueRetry(sessionId, attempt, `ended as ${status}`)) {
            adjustConcurrency(-1, `${status} outcomes`)
            return
          }
          restoreStats.failed += 1
          return
        }

        if (isTransientStatus(status)) {
          if (!queueRetry(sessionId, attempt, `still ${status}`)) {
            restoreStats.deferred += 1
          }
          return
        }

        if (!queueRetry(sessionId, attempt, `ended with status ${status || 'unknown'}`)) {
          restoreStats.failed += 1
        }
      }

      const launchNextRestore = () => {
        while (activeSessionIds.size < currentConcurrency && pendingRestoreJobs.length > 0) {
          if (getTransientCount() >= restoreMaxTransient) {
            break
          }

          const now = Date.now()
          const nextReadyIndex = pendingRestoreJobs.findIndex(job => job.readyAt <= now)
          if (nextReadyIndex === -1) {
            break
          }

          const [job] = pendingRestoreJobs.splice(nextReadyIndex, 1)
          if (!job?.sessionId) break

          const { sessionId, attempt } = job
          activeSessionIds.add(sessionId)

          void (async () => {
            try {
              const existing = sessionManager.getSession(sessionId)
              const existingStatus = String(existing?.status || '').toLowerCase()
              if (existing?.pid && !['stopped', 'crashed', 'logged_out'].includes(existingStatus)) {
                restoreStats.skippedActive += 1
                console.log(
                  `Skipping restore start for ${sessionId}; already active in status ${existingStatus || 'unknown'}`
                )
                return
              }

              restoreStats.startedAttempts += 1
              console.log(`Auto-starting session ${sessionId} (attempt ${attempt}/${restoreMaxAttempts})...`)
              try {
                await sessionManager.startSession(sessionId, {
                  phoneNumber: '',
                  pairing: false,
                })
              } catch (sessionError) {
                console.error(`Failed to auto-start ${sessionId}:`, sessionError.message)
                adjustConcurrency(-1, 'start failures')
                if (!queueRetry(sessionId, attempt, 'failed to start')) {
                  restoreStats.failed += 1
                }
                return
              }

              const settleResult = await waitForSessionToSettle(sessionId)
              await handleRestoreOutcome(sessionId, attempt, settleResult)
            } finally {
              activeSessionIds.delete(sessionId)
              launchNextRestore()
            }
          })()
        }
      }

      launchNextRestore()
      while (pendingRestoreJobs.length > 0 || activeSessionIds.size > 0) {
        await new Promise(resolve => setTimeout(resolve, restoreKickDelayMs))
        launchNextRestore()
      }

      console.log(
        `Session restore summary: attempts=${restoreStats.startedAttempts}, retried=${restoreStats.retried}, running=${restoreStats.running}, logged_out=${restoreStats.loggedOut}, deferred=${restoreStats.deferred}, failed=${restoreStats.failed}, skipped_active=${restoreStats.skippedActive}, final_concurrency=${currentConcurrency}`
      )
    } else {
      console.log(`No creds found — waiting for user to connect via dashboard.`)
    }
  } catch (error) {
    console.error('Auto-start session failed:', error.message)
  }
})
