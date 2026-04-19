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
    const restoreBatchSize = Math.max(1, Number(process.env.SESSION_RESTORE_BATCH_SIZE || 2))
    const restoreDelayMs = Math.max(1000, Number(process.env.SESSION_RESTORE_DELAY_MS || 5000))
    const restoreSettleMs = Math.max(15000, Number(process.env.SESSION_RESTORE_SETTLE_MS || 45000))
    const restorePollMs = Math.max(500, Number(process.env.SESSION_RESTORE_POLL_MS || 2000))
    // Find all sessions with existing credentials
    const sessionsDir = path.join(projectRoot, 'sessions')
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true })
    const existingSessionIds = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const credsPath = path.join(sessionsDir, entry.name, 'auth', 'creds.json')
      if (fs.existsSync(credsPath)) {
        existingSessionIds.push(entry.name)
      }
    }

    if (existingSessionIds.length > 0) {
        console.log(
          `Auto-starting ${existingSessionIds.length} session(s) with existing creds: ${existingSessionIds.join(", ")}`
        )
        console.log(`Session restore pacing: ${restoreBatchSize} worker(s) per batch, ${restoreDelayMs}ms between batches, settle timeout ${restoreSettleMs}ms`)

      const waitForSessionToSettle = async sessionId => {
        const deadline = Date.now() + restoreSettleMs
        while (Date.now() < deadline) {
          const current = sessionManager.getSession(sessionId)
          const status = String(current?.status || '').toLowerCase()
          if (!['starting', 'connecting', 'reconnecting', 'pairing'].includes(status)) {
            return current
          }
          await new Promise(resolve => setTimeout(resolve, restorePollMs))
        }
        return sessionManager.getSession(sessionId)
      }

      for (let offset = 0; offset < existingSessionIds.length; offset += restoreBatchSize) {
        const batch = existingSessionIds.slice(offset, offset + restoreBatchSize)

        await Promise.all(batch.map(async sessionId => {
          const existing = sessionManager.getSession(sessionId)
          if (existing && existing.pid) return

          console.log(`Auto-starting session ${sessionId}...`)
          try {
            await sessionManager.startSession(sessionId, {
              phoneNumber: '',
              pairing: false,
            })
            console.log(`Session ${sessionId} started`)
          } catch (sessionError) {
            console.error(`Failed to auto-start ${sessionId}:`, sessionError.message)
          }
        }))

        await Promise.all(batch.map(sessionId => waitForSessionToSettle(sessionId)))

        if (offset + restoreBatchSize < existingSessionIds.length) {
          await new Promise(resolve => setTimeout(resolve, restoreDelayMs))
        }
      }
    } else {
      console.log(`No creds found — waiting for user to connect via dashboard.`)
    }
  } catch (error) {
    console.error('Auto-start session failed:', error.message)
  }
})
