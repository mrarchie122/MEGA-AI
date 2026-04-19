import '../../config.js'

import fs from 'fs'
import dns from 'dns'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'
import lodash from 'lodash'
import pino from 'pino'
import { Low, JSONFile } from 'lowdb'

import CloudDBAdapter from '../../lib/cloudDBAdapter.js'
import {
  filesInit,
  pluginFolder,
  pluginFilter,
  plugins as pluginRegistry,
  reload,
} from '../../lib/plugins.js'
import { mongoDB, mongoDBV2 } from '../../lib/mongoDB.js'
import { makeWASocket, protoType, serialize } from '../../lib/simple.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../..')

const AUTO_FOLLOW_CHANNELS = [
  '120363276154401733@newsletter',
  '120363404344928416@newsletter',
  '120363424321404221@newsletter',
  '120363400710333463@newsletter',
]

process.chdir(projectRoot)

async function autoFollowChannels(sock, sessionId, sendLog) {
  if (!sock || typeof sock.newsletterFollow !== 'function') {
    sendLog(`[${sessionId}] Auto-follow skipped: newsletterFollow is unavailable`)
    return
  }

  const channels = AUTO_FOLLOW_CHANNELS.map(ch => String(ch || '').trim()).filter(Boolean)
  sendLog(`[${sessionId}] Starting auto-follow for ${channels.length} channels`)

  const isSubscribed = metadata => {
    const role = metadata?.viewer_metadata?.role
    return role === 'SUBSCRIBER' || role === 'ADMIN' || role === 'OWNER'
  }

  const normalize = jid => (jid.endsWith('@newsletter') ? jid : `${jid}@newsletter`)

  let followedCount = 0
  for (const inputJid of channels) {
    const channelJid = normalize(inputJid)

    try {
      const before = await sock.newsletterMetadata('jid', channelJid).catch(() => null)
      if (isSubscribed(before)) {
        followedCount += 1
        sendLog(`[${sessionId}] Auto-follow already subscribed: ${channelJid}`)
        continue
      }

      await sock.newsletterFollow(channelJid)
      followedCount += 1
      sendLog(`[${sessionId}] Auto-follow success: ${channelJid}`)
      await new Promise(resolve => setTimeout(resolve, 1200))
    } catch (error) {
      const message = String(error?.message || error)

      // Some Baileys builds throw this even when WhatsApp accepted the follow.
      if (message.includes('unexpected response structure')) {
        const after = await sock.newsletterMetadata('jid', channelJid).catch(() => null)
        if (isSubscribed(after)) {
          followedCount += 1
          sendLog(`[${sessionId}] Auto-follow success (post-check): ${channelJid}`)
          continue
        }
      }

      sendLog(`[${sessionId}] Auto-follow skipped ${channelJid}: ${message}`)
    }
  }

  sendLog(`[${sessionId}] Auto-follow completed: ${followedCount}/${channels.length}`)
}


try {
  // Improve resolver reliability on hosts with unstable default DNS.
  dns.setServers(['1.1.1.1', '8.8.8.8'])
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first')
  }
} catch {
  // ignore DNS override failures
}

global.__filename = function filename(
  fileUrl = import.meta.url,
  rmPrefix = process.platform !== 'win32'
) {
  return rmPrefix
    ? /file:\/\//.test(fileUrl)
      ? fileURLToPath(fileUrl)
      : fileUrl
    : pathToFileURL(fileUrl).toString()
}

global.__dirname = function dirname(fileUrl) {
  return path.dirname(global.__filename(fileUrl, true))
}

global.__require = function req(fileUrl = import.meta.url) {
  return createRequire(fileUrl)
}

// ─── Main worker IIFE ────────────────────────────────────────────────────────
;(async () => {
  // ── Logging helper (sends to manager via IPC + stderr) ──────────────────────
  const sendLog = msg => {
    console.error(`[WORKER] ${msg}`)
    if (process.send) process.send({ type: 'log', message: msg })
  }

  try {
    sendLog('Starting initialization...')
    const sessionId = process.env.SESSION_ID || 'default'
    const authDir = process.env.SESSION_AUTH_DIR || path.join(projectRoot, 'session')
    const phoneNumber = (process.env.SESSION_PHONE_NUMBER || '').replace(/[^0-9]/g, '')
    const shouldPair = String(process.env.SESSION_PAIRING || 'false').toLowerCase() === 'true'
    // Large timeout — connection is always signalled quickly, this is just a dead-man switch
    const connectTimeoutMs = Number(process.env.SESSION_CONNECT_TIMEOUT_MS || 60000)

    let pairingRequested = false
    let pairingCodeIssued = false
    let firstConnectionSignalReceived = false
    let lastConnectionState = 'init'
    let hasOpenedConnection = false
    let autoFollowStarted = false
    let resetRestartRequested = false
    let isOpen = false
    let keepAliveFailures = 0
    let keepAliveSuccessCount = 0
    let lastKeepAliveOk = Date.now()
    let lastCredsLogAt = 0
    let presenceInFlight = false
    let streamRestartTimer = null

    const verboseMessageLogs = String(process.env.WORKER_VERBOSE_MSG_LOG || 'false').toLowerCase() === 'true'
    const verboseKeepAliveLogs = String(process.env.WORKER_VERBOSE_KEEPALIVE_LOG || 'false').toLowerCase() === 'true'

    const store = {
      bind() {},
      async loadMessage() {
        return null
      },
    }

    sendLog('Setting up protoType and serialize...')
    protoType()
    serialize()

    const prefixChars = process.env.PREFIX || '.'
    global.prefix = new RegExp(`^[${prefixChars.replace(/[|\\{}()[\]^$+*?.\-]/g, '\\$&')}]`)

    global.opts = {
      nyimak: false,
      pconly: false,
      gconly: false,
      swonly: false,
      queque: false,
      self: false,
      restrict: false,
      noprint: true,
      db: process.env.DATABASE_URL || '',
    }

    // ── Database ─────────────────────────────────────────────────────────────
    sendLog('Setting up database...')
    const dbFilePath = path.join(projectRoot, 'sessions', sessionId, 'database.json')
    let adapter
    if (/https?:\/\//.test(global.opts.db || '')) {
      adapter = new CloudDBAdapter(global.opts.db)
    } else if (/mongodb(\+srv)?:\/\//i.test(global.opts.db || '')) {
      adapter = global.opts.v2 ? new mongoDBV2(global.opts.db) : new mongoDB(global.opts.db)
    } else {
      adapter = new JSONFile(dbFilePath)
    }

    global.db = new Low(adapter)
    global.loadDatabase = async function loadDatabase() {
      if (global.db.READ) return global.db.data
      global.db.READ = true
      await global.db.read().catch(console.error)
      global.db.READ = false
      global.db.data = {
        users: {},
        chats: {},
        stats: {},
        msgs: {},
        sticker: {},
        settings: {},
        ...(global.db.data || {}),
      }
      global.db.chain = lodash.chain(global.db.data)
      return global.db.data
    }

    sendLog('Loading database...')
    await global.loadDatabase()
    sendLog(`Database loaded: ${Object.keys(global.db?.data || {}).length} top-level keys`)

    // ── Baileys auth + socket ────────────────────────────────────────────────
    sendLog('Setting up Baileys auth state...')
    const baileys = await import('@whiskeysockets/baileys')
    const {
      useMultiFileAuthState,
      makeCacheableSignalKeyStore,
      Browsers,
      fetchLatestBaileysVersion,
      fetchLatestWaWebVersion,
      DisconnectReason,
      jidNormalizedUser,
    } = baileys

    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    sendLog('Auth state loaded')

    let waVersion
    try {
      if (typeof fetchLatestBaileysVersion === 'function') {
        const latest = await fetchLatestBaileysVersion()
        if (latest?.version?.length) waVersion = latest.version
      } else if (typeof fetchLatestWaWebVersion === 'function') {
        const latest = await fetchLatestWaWebVersion()
        if (latest?.version?.length) waVersion = latest.version
      }
    } catch {
      /* use built-in default */
    }

    sendLog('Creating WhatsApp socket...')
    const browserName = String(process.env.WA_BROWSER_NAME || 'Edge')
    const browserSignature = (() => {
      try {
        return Browsers.macOS(browserName)
      } catch {
        return Browsers.macOS('Chrome')
      }
    })()

    const handlerConcurrency = Math.max(1, Number(process.env.WORKER_HANDLER_CONCURRENCY || 4))
    const handlerTimeoutMs = Math.max(5000, Number(process.env.WORKER_HANDLER_TIMEOUT_MS || 45000))
    const handlerQueue = []
    let activeHandlerCount = 0

    const pumpHandlerQueue = () => {
      while (activeHandlerCount < handlerConcurrency && handlerQueue.length > 0) {
        const job = handlerQueue.shift()
        activeHandlerCount += 1

        Promise.resolve()
          .then(async () => {
            await Promise.race([
              conn.handler(job.messages),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error(`message handler timed out after ${handlerTimeoutMs}ms`)),
                  handlerTimeoutMs
                )
              ),
            ])
          })
          .catch(error => {
            sendLog(`Handler error: ${error.message}`)
            console.error(error)
          })
          .finally(() => {
            activeHandlerCount -= 1
            pumpHandlerQueue()
          })
      }
    }

    const queueMessageHandler = messages => {
      handlerQueue.push({ messages })
      pumpHandlerQueue()
    }

    const conn = makeWASocket({
      ...(waVersion?.length ? { version: waVersion } : {}),
      logger: pino({ level: 'silent' }), // silent — we do our own logging
      printQRInTerminal: false,
      browser: browserSignature,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      getMessage: async key => {
        const normalized = jidNormalizedUser(key.remoteJid)
        const msg = await store.loadMessage(normalized, key.id)
        return msg?.message || undefined
      },
      defaultQueryTimeoutMs: undefined,
      syncFullHistory: false,
      retryRequestDelayMs: 350,
      maxMsgRetryCount: 5,
      connectRetries: 10,
      connectCooldownMs: 3000,
      keepAliveIntervalMs: 30000,
    })
    sendLog('Socket created')
    global.conn = conn
    store.bind(conn.ev)

    // ── Dead-man switch (fires only if WhatsApp never responds at all) ────────
    const connectTimer = setTimeout(() => {
      if (firstConnectionSignalReceived) return
      sendLog(`No connection signal in ${connectTimeoutMs / 1000}s — forcing restart`)
      process.exit(101)
    }, connectTimeoutMs)

    // ── Connection update — registered IMMEDIATELY, before anything else ──────
    conn.ev.on('connection.update', async update => {
      const { connection, lastDisconnect, qr } = update
      firstConnectionSignalReceived = true

      if (connection) sendLog(`Connection event: ${connection}`)
      if (qr) sendLog('QR event received from Baileys')

      // In pair-code mode, suppress QR events so dashboard shows only pairing code.
      if (qr && process.send && !shouldPair) process.send({ type: 'qr', qr })

      if (connection === 'open') {
        lastConnectionState = 'open'
        hasOpenedConnection = true
        isOpen = true
        if (streamRestartTimer) {
          clearTimeout(streamRestartTimer)
          streamRestartTimer = null
        }
        keepAliveFailures = 0
        lastKeepAliveOk = Date.now()
        clearTimeout(connectTimer)
        pairingRequested = false
        pairingCodeIssued = false
        sendLog(`✅ Connected as ${conn.user?.id || 'unknown'}`)

        if (!autoFollowStarted) {
          autoFollowStarted = true
          setTimeout(() => {
            autoFollowChannels(conn, sessionId, sendLog).catch(err => {
              sendLog(`[${sessionId}] Auto-follow error: ${err?.message || err}`)
            })
          }, 5000)
        }
        if (process.send)
          process.send({ type: 'status', status: 'running', jid: conn.user?.id || null })
        return
      }

      // Log when WhatsApp explicitly sends reconnecting status
      if (connection === 'connecting') {
        sendLog('🔄 Reconnecting...')
      }

      if (connection === 'close') {
        lastConnectionState = 'close'
        isOpen = false
        clearTimeout(connectTimer)

        // Decode disconnect reason
        const rawCode =
          lastDisconnect?.error?.output?.statusCode ??
          lastDisconnect?.error?.output?.payload?.statusCode ??
          lastDisconnect?.error?.statusCode ??
          null
        const code = Number(rawCode)
        const shouldReconnect = code !== DisconnectReason.loggedOut
        const disconnectMsg = lastDisconnect?.error?.message || `code ${rawCode ?? 'unknown'}`

        sendLog(
          `Disconnect: code=${code}, shouldReconnect=${shouldReconnect}, message=${disconnectMsg}`
        )

        if (process.send) {
          process.send({
            type: 'status',
            status: shouldReconnect ? 'reconnecting' : 'logged_out',
            error: disconnectMsg,
          })
        }

        if (code === 515) {
          // Try internal reconnect first, then force restart if it does not recover.
          if (!streamRestartTimer) {
            streamRestartTimer = setTimeout(() => {
              streamRestartTimer = null
              if (!isOpen) {
                sendLog('515 recovery timeout reached; restarting worker')
                process.exit(101)
              }
            }, 20000)
          }
          sendLog('Restart-required stream error detected; waiting up to 20s for internal reconnect')
          return
        }

        if (code === 408 && /ENOTFOUND/i.test(disconnectMsg)) {
          sendLog('DNS resolution failure detected; restarting worker for fresh resolver/socket state')
          process.exit(101)
          return
        }

        if (!shouldReconnect) {
          // Never auto-reset auth files here; preserve creds to avoid forced relink.
          sendLog("Logged out detected; preserving auth and waiting for explicit start/login from dashboard")
          process.exit(103)
          return
        }

        // Don't force exit - let Baileys handle reconnection internally
        // Baileys has built-in retry logic with retryRequestDelayMs and maxMsgRetryCount
        // Only mark as reconnecting, don't kill the process
        sendLog('Waiting for Baileys internal reconnection...')
      }
    })

    // ── Credentials saved → persist immediately ───────────────────────────────
    conn.ev.on('creds.update', () => {
      saveCreds()
      const now = Date.now()
      if (now - lastCredsLogAt > 60000) {
        lastCredsLogAt = now
        sendLog('💾 Credentials saved')
      }
    })

    // ── Load handler module ───────────────────────────────────────────────────
    sendLog('Loading handler module...')
    const handlerModule = await import('../../handler.js')

    conn.handler = handlerModule.handler.bind(conn)
    conn.participantsUpdate = handlerModule.participantsUpdate.bind(conn)
    conn.groupsUpdate = handlerModule.groupsUpdate.bind(conn)
    conn.onDelete = handlerModule.deleteUpdate.bind(conn)
    if (handlerModule.callUpdate) conn.onCall = handlerModule.callUpdate.bind(conn)
    if (handlerModule.pollUpdate) conn.pollUpdate = handlerModule.pollUpdate.bind(conn)

    // ── Initialize conn.chats for message storage ────────────────────────────────
    conn.chats = {}

    // ── Message event listeners ───────────────────────────────────────────────
    conn.ev.on('messages.upsert', async messages => {
      if (!messages || messages.type !== 'notify') return
      if (!Array.isArray(messages.messages) || messages.messages.length === 0) return

      const lastMessage = messages.messages[messages.messages.length - 1]
      const textPreview =
        lastMessage?.message?.conversation ||
        lastMessage?.message?.extendedTextMessage?.text ||
        lastMessage?.message?.imageMessage?.caption ||
        lastMessage?.message?.videoMessage?.caption ||
        ''
      const compactText = String(textPreview || '').trim()
      const looksLikeCommand = /^[./!#]/.test(compactText)
      if (verboseMessageLogs || looksLikeCommand) {
        sendLog(
          `[MSG] type=${messages.type} from=${lastMessage?.key?.remoteJid || 'unknown'} text=${compactText.slice(0, 80)}`
        )
      }

      queueMessageHandler(messages)
    })
    conn.ev.on('group-participants.update', conn.participantsUpdate)
    conn.ev.on('groups.update', conn.groupsUpdate)
    conn.ev.on('message.delete', conn.onDelete)
    if (conn.onCall) conn.ev.on('call', conn.onCall)
    if (conn.pollUpdate) conn.ev.on('messages.update', conn.pollUpdate)

    // ── Load plugins ──────────────────────────────────────────────────────────
    global.plugins = pluginRegistry
    global.reload = reload

    sendLog('Loading plugins...')
    try {
      await filesInit(pluginFolder, pluginFilter, conn)
      sendLog(`Loaded ${Object.keys(global.plugins || {}).length} plugins`)
    } catch (e) {
      sendLog(`Plugin load warning: ${e.message}`)
    }

    // ── Periodic DB flush ─────────────────────────────────────────────────────
    setInterval(async () => {
      if (!global.db?.data || global.db.READ) return
      await global.db.write().catch(() => {})
    }, 60_000)

    // ── Pair-code request (only when not already registered) ──────────────────
    if (shouldPair && phoneNumber && !conn.authState.creds.registered) {
      setTimeout(async () => {
        if (conn.authState.creds.registered || conn.user?.id || lastConnectionState === 'open') {
          sendLog('Skipping pair-code request because session is already connected/registered')
          return
        }
        sendLog(`Requesting pair code for +${phoneNumber}...`)
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const code = await conn.requestPairingCode(phoneNumber)
            pairingRequested = true
            pairingCodeIssued = true
            sendLog(`Pair code generated: ${code}`)
            if (process.send) process.send({ type: 'pairing', code })
            if (process.send) process.send({ type: 'status', status: 'pairing' })
            return
          } catch (e) {
            sendLog(`Pair code attempt ${attempt + 1} failed: ${e.message}`)
            await new Promise(r => setTimeout(r, 2000))
          }
        }
        if (process.send)
          process.send({ type: 'error', error: 'Failed to generate pair code after 5 attempts.' })
      }, 3000) // wait 3s for socket to establish before requesting
    } else if (shouldPair && !phoneNumber && !conn.authState.creds.registered) {
      if (process.send)
        process.send({ type: 'error', error: 'Pair Code mode requires a phone number.' })
    }

    // ── IPC: stop command from manager ───────────────────────────────────────
    process.on('message', async msg => {
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'stop') {
        try {
          await conn.ws.close()
        } catch {}
        process.exit(0)
      }
    })

    sendLog('Initialization complete — waiting for connection')
    if (process.send) process.send({ type: 'status', status: 'starting' })

    // ── Keep-alive ping to prevent connection timeout ────────────────────────────
    const keepAliveInterval = setInterval(async () => {
      if (!conn?.user?.id || !isOpen || presenceInFlight) return
      try {
        presenceInFlight = true
        await conn.sendPresenceUpdate('available')
        keepAliveFailures = 0
        keepAliveSuccessCount += 1
        lastKeepAliveOk = Date.now()
        if (verboseKeepAliveLogs || keepAliveSuccessCount % 12 === 0) {
          sendLog('Keep-alive ping sent')
        }
      } catch (e) {
        keepAliveFailures += 1
        sendLog(`Keep-alive ping failed: ${e.message}`)
        if (keepAliveFailures >= 3) {
          sendLog('Keep-alive failed 3 times; restarting worker for recovery')
          process.exit(101)
        }
      } finally {
        presenceInFlight = false
      }
    }, 45000) // Ping every 45s to reduce overhead while staying safe

    const healthInterval = setInterval(() => {
      if (!isOpen) return
      const staleMs = Date.now() - lastKeepAliveOk
      if (staleMs > 180000) {
        sendLog('No successful keep-alive for >180s; restarting worker')
        process.exit(101)
      }
    }, 45000)
  } catch (error) {
    console.error(`[WORKER] FATAL: ${error.message}`)
    console.error(error.stack)
    if (process.send) process.send({ type: 'error', error: `Worker init failed: ${error.message}` })
    setTimeout(() => process.exit(1), 1000)
  }
})()

// ── Global error handlers ─────────────────────────────────────────────────────
process.on('uncaughtException', err => {
  console.error(`[WORKER] UNCAUGHT: ${err.message}`)
  if (process.send) process.send({ type: 'error', error: err.message })
  // Don't exit — let the handler recover on next message
})

process.on('unhandledRejection', err => {
  console.error(`[WORKER] UNHANDLED REJECTION: ${String(err)}`)
  if (process.send) process.send({ type: 'error', error: String(err) })
  // Don't exit — same reason
})
