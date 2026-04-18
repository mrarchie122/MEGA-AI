// Minimal Baileys connection test to diagnose the "Connection Failure" issue
import '@whiskeysockets/baileys'

const baileys = await import('@whiskeysockets/baileys')
const { makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = baileys

const authDir = './test-auth'
const { state, saveCreds } = await useMultiFileAuthState(authDir)

console.log('Creating socket with connection logging...')

const sock = makeWASocket({
  auth: state,
  browser: Browsers.macOS('Test'),
  logger: require('pino')({ level: 'trace' }),
  printQRInTerminal: true,
})

sock.ev.on('connection.update', update => {
  const { connection, lastDisconnect, qr } = update
  console.log('CONNECTION UPDATE:', { connection, qr: !!qr })
  if (qr) console.log('QR EMITTED')
  if (connection === 'open') console.log('CONNECTED!')
  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode
    console.log('DISCONNECTED:', { code, reason: DisconnectReason[code] })
    process.exit(0)
  }
})

sock.ev.on('creds.update', saveCreds)

// Timeout after 30 seconds
setTimeout(() => {
  console.log('TIMEOUT: No connection after 30 seconds')
  process.exit(1)
}, 30000)
