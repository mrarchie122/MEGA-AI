// MEGA-AI WhatsApp Bot — Entry Point (deobfuscated)

import dotenv from 'dotenv'
dotenv.config()

import chalk from 'chalk'
import { spawn } from 'child_process'
import express from 'express'
import figlet from 'figlet'
import fs from 'fs'
import fetch from 'node-fetch'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── Banner ───────────────────────────────────────────────────────────────────
figlet('MEGA', { font: 'Ghost', horizontalLayout: 'default', verticalLayout: 'default' }, (err, text) => {
  if (err) { console.error(chalk.red('Figlet error:', err)); return }
  console.log(chalk.green(text))
})

figlet('WHATSAPP', { horizontalLayout: 'default', verticalLayout: 'default' }, (err, text) => {
  if (err) { console.error(chalk.red('Figlet error:', err)); return }
  console.log(chalk.magenta(text))
})

// ─── Express static server (legacy — main server is src/server.js) ────────────
const app = express()
const port = process.env.PORT || 3000

app.use(express.static(path.join(__dirname, 'assets')))
app.get('/', (_req, res) => res.redirect('/global.html'))
app.listen(port, () => console.log(chalk.cyan(`Port ${port} is open`)))

// ─── Bot process management ───────────────────────────────────────────────────
let isRunning = false

async function start(scriptFile) {
  if (isRunning) return
  isRunning = true

  const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), scriptFile)
  const args = [scriptPath, ...process.argv.slice(2)]

  const child = spawn(process.argv[0], args, {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  })

  child.on('exit', (code) => {
    console.log(chalk.yellow(`Exited with code: ${code}`))
    switch (code) {
      case 'reset':
        child.kill()
        isRunning = false
        start.apply(this, arguments)
        break
      case 'KOFBS': // unhandledRejection restart signal
        child.send(process.exit())
        break
    }
  })

  child.on('close', (code) => {
    isRunning = false
    console.error(chalk.red(`Exited with code: ${code}`))
    if (code === 0) return
    fs.watchFile(args[0], () => {
      fs.unwatchFile(args[0])
      start('global.js')
    })
  })

  child.on('error', (err) => {
    console.error(chalk.red(`Error: ${err}`))
    child.kill()
    isRunning = false
    start('global.js')
  })

  // Watch global.js for hot-reload
  const globalJsPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'global.js')
  fs.watchFile(globalJsPath, async (curr, prev) => {
    if (curr) {
      console.log(chalk.green(`✔️ RECEIVED ${curr.length}`))
      try {
        const { default: baileys } = await import('@whiskeysockets/baileys')
        const version = (await baileys.fetchLatestBaileysVersion()).version
        console.log(chalk.green(`Using Baileys library version ${version}`))
      } catch {
        console.error(chalk.red(`Baileys library is not installed`))
      }
    }
  })
}

start('global.js')

// ─── Crash recovery ───────────────────────────────────────────────────────────
process.on('unhandledRejection', () => {
  console.error(chalk.red('Unhandled promise rejection. Bot will restart...'))
  start('global.js')
})

process.on('KOFBS', (err) => {
  console.error(chalk.red(`Unhandled rejection. Bot will restart...`))
  console.error(chalk.red('Error:'))
  start('global.js')
})

// ─── Keep-alive ping ──────────────────────────────────────────────────────────
function keepAlive() {
  const appUrl = process.env.APP_URL
  if (!appUrl) {
    console.log('No APP_URL provided, skipping keepAlive...')
    return
  }
  if (/(\/\/|\.)undefined\./.test(appUrl)) {
    console.log('Invalid APP_URL format, skipping keepAlive...')
    return
  }
  setInterval(() => {
    fetch(appUrl).catch(console.error)
  }, 5 * 60 * 1000) // every 5 minutes
}
