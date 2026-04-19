import { createHash } from 'crypto'
import PhoneNumber from 'awesome-phonenumber'
import { canLevelUp, xpRange } from '../lib/levelling.js'
import fetch from 'node-fetch'
import fs from 'fs'
const { levelling } = '../lib/levelling.js'
import moment from 'moment-timezone'
import { promises } from 'fs'
import { join } from 'path'
const OwnerName = process.env.OWNER_NAME || 'ARCHIE TECH NEXUS';
const BOTNAME = process.env.BOTNAME || 'ARCHIE-MD-WEB-BOT';
const timeZone = process.env.TIME_ZONE || 'Asia/Karachi';
const time = moment.tz(timeZone).format('HH');
let wib = moment.tz(timeZone).format('HH:mm:ss');


const MENU_BOLD_MAP = {'A':'𝐀', 'B':'𝐁', 'C':'𝐂', 'D':'𝐃', 'E':'𝐄', 'F':'𝐅', 'G':'𝐆', 'H':'𝐇', 'I':'𝐈', 'J':'𝐉', 'K':'𝐊', 'L':'𝐋', 'M':'𝐌', 'N':'𝐍', 'O':'𝐎', 'P':'𝐏', 'Q':'𝐐', 'R':'𝐑', 'S':'𝐒', 'T':'𝐓', 'U':'𝐔', 'V':'𝐕', 'W':'𝐖', 'X':'𝐗', 'Y':'𝐘', 'Z':'𝐙', 'a':'𝐚', 'b':'𝐛', 'c':'𝐜', 'd':'𝐝', 'e':'𝐞', 'f':'𝐟', 'g':'𝐠', 'h':'𝐡', 'i':'𝐢', 'j':'𝐣', 'k':'𝐤', 'l':'𝐥', 'm':'𝐦', 'n':'𝐧', 'o':'𝐨', 'p':'𝐩', 'q':'𝐪', 'r':'𝐫', 's':'𝐬', 't':'𝐭', 'u':'𝐮', 'v':'𝐯', 'w':'𝐰', 'x':'𝐱', 'y':'𝐲', 'z':'𝐳', '0':'𝟎', '1':'𝟏', '2':'𝟐', '3':'𝟑', '4':'𝟒', '5':'𝟓', '6':'𝟔', '7':'𝟕', '8':'𝟖', '9':'𝟗'}

function toBoldMenuToken(token = '') {
  return String(token)
    .split('')
    .map(ch => MENU_BOLD_MAP[ch] || ch)
    .join('')
}

function styleMenuCommands(text = '', usedPrefix = '.') {
  return String(text).replace(/\*([^*]+)\*/g, (_m, token) => {
    const trimmed = token.trim()
    const plain = trimmed.replace(/^[^a-z0-9]+/i, '')
    if (!plain || plain !== plain.toLowerCase() || !/^[a-z0-9][a-z0-9_\/-]*$/.test(plain)) return `*${token}*`
    return `*${usedPrefix}${toBoldMenuToken(plain)}*`
  })
}

const MENU_NEWSLETTER_INFO = {
  contextInfo: {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: '120363276154401733@newsletter',
      newsletterName: 'ARCHIE-MD BOT',
      serverMessageId: 143,
    },
  },
}

let handler = async (m, { conn, usedPrefix, command}) => {
    let d = new Date(new Date + 3600000)
    let locale = 'en'
    let week = d.toLocaleDateString(locale, { weekday: 'long' })
    let date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    let _uptime = process.uptime() * 1000
    let uptime = clockString(_uptime)
let who = m.quoted ? m.quoted.sender : m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? (conn.user?.id || '') : m.sender
if (!(who in global.db.data.users)) {
  global.db.data.users[who] = global.db.data.users[who] || {
    exp: 0,
    level: 0,
    role: 'Tadpole',
    registered: false,
    name: conn.getName(who),
    warn: 0,
  }
}
let pp = './assets/A.jpg'
let user = global.db.data.users[who]
let { name, exp, diamond, lastclaim, registered, regTime, age, level, role, warn } = global.db.data.users[who]
let { min, xp, max } = xpRange(user.level, global.multiplier)
let username = conn.getName(who)
let math = max - xp
let prem = global.prems.includes(who.split`@`[0])
let sn = createHash('md5').update(who).digest('hex')
let totaluser = Object.values(global.db.data.users).length 
let rtotalreg = Object.values(global.db.data.users).filter(user => user.registered == true).length 
let more = String.fromCharCode(8206)
let readMore = more.repeat(850) 
let greeting = ucapan()
let quote = quotes[Math.floor(Math.random() * quotes.length)];

let taguser = '@' + m.sender.split("@s.whatsapp.net")[0]
let str = `
🚀 *_BUCKLE UP ${name}, ${greeting}! WE'RE GOING ON AN ADVENTURE!_* 🚀
📋 *_QUOTE OF THE DAY: ${quote}_* 📋
◈╭──❍「 *USER INFO* 」❍
◈├• 🦸 *Owner:* ${OwnerName}
◈├• 🏆 *Rank:* ${role}
◈├• 🎮 *XP:* ${exp} 
◈├• 🎩 *USER*:${username}
◈╰─┬─★─☆──♪♪─❍
◈╭─┴❍「 *BOT STATUS* 」❍
◈├• 📆  *Date:* ${date}
◈├• ⏲️  *Time:* ${wib}
◈├• 🤡  *Bot:* ${BOTNAME} 
◈├• 📣  *Prefix:* ${usedPrefix} 
◈├• 🕓  *Uptime:* ${uptime}
◈├• 💌  *Database:* ${rtotalreg} of ${totaluser} 
◈├• 📚  *Total Users:* ${totaluser}
◈╰─┬─★─☆──♪♪─❍
◈╭─┴❍「 *MAIN MENU* 」❍
◈├• *allmenu*
◈├• *aimenu*
◈├• *aeditor*
◈├• *animemenu*
◈├• *autoreact*
◈├• *botmenu*
◈├• *dlmenu*
◈├• *economy*
◈├• *enable*
◈├• *fancy*
◈├• *funmenu*
◈├• *gamesmenu*
◈├• *groupmenu*
◈├• *imagen*
◈├• *infoanime*
◈├• *listmenu*
◈├• *listplugin*
◈├• *logomenu*
◈├• *makermenu*
◈├• *menu*
◈├• *menu3*
◈├• *menu4*
◈├• *nsfwmenu*
◈├• *randompic*
◈├• *randomvid*
◈├• *reactions*
◈├• *stickermenu*
◈├• *textpro*
◈├• *toolsmenu*
◈├• *ownermenu*
◈├• *setprivacy*
◈╰─♪♪─★─☆──♪♪─❍
© *ARCHIE TECH NEXUS*

`

    

str = styleMenuCommands(str, usedPrefix)

       // await conn.sendMessage(m.chat, { video: { url: [pp, pp2, pp3, pp4, pp5, pp6, pp7, pp8, pp9, pp10, pp11, pp12, pp13, pp14, pp15].getRandom() }, gifPlayback: true, caption: text.trim(), mentions: [m.sender] }, { quoted: estilo })
    


  await conn.sendFile(m.chat, pp, 'perfil.jpg', str, m, null, {
    ...MENU_NEWSLETTER_INFO,
    mentions: [m.sender],
    contextInfo: {
      ...MENU_NEWSLETTER_INFO.contextInfo,
      mentionedJid: [m.sender],
    },
  })
  await m.react('✅')

}
handler.help = ['main']
handler.tags = ['group']
handler.command = ['menu2', 'help2'] 

export default handler
function clockString(ms) {
    let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
    let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
    let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
    return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')}
    
    function ucapan() {
      const time = moment.tz('Asia/Karachi').format('HH')
      let res = "happy early in the day☀️"
      if (time >= 4) {
        res = "Good Morning 🌄"
      }
      if (time >= 10) {
        res = "Good Afternoon ☀️"
      }
      if (time >= 15) {
        res = "Good Afternoon 🌇"
      }
      if (time >= 18) {
        res = "Good Night 🌙"
      }
      return res
    }
    const quotes = [
      "I'm not lazy, I'm just on my energy saving mode.",
      "Life is short, smile while you still have teeth.",
      "I may be a bad influence, but darn I am fun!",
      "I'm on a whiskey diet. I've lost three days already.",
      "Why don't some couples go to the gym? Because some relationships don't work out.",
      "I told my wife she should embrace her mistakes... She gave me a hug.",
      "I'm great at multitasking. I can waste time, be unproductive, and procrastinate all at once.",
      "You know you're getting old when you stoop to tie your shoelaces and wonder what else you could do while you're down there.",
      "I'm so good at sleeping, I can do it with my eyes closed.",
      "If you think nobody cares if you’re alive, try missing a couple of payments.",
      "I used to think I was indecisive, but now I'm not so sure.",
      "If you can't convince them, confuse them.",
      "I told my wife she was drawing her eyebrows too high. She looked surprised.",
      "I'm not clumsy, I'm just on a mission to test gravity.",
      "I told my wife she should do more push-ups. She said, 'I could do a hundred!' So I counted to ten and stopped.",
      "Life is like a box of chocolates; it doesn't last long if you're hungry.",
      "I'm not saying I'm Wonder Woman, I'm just saying no one has ever seen me and Wonder Woman in the same room together.",
      "Why do they call it beauty sleep when you wake up looking like a troll?",
      "I don't always lose my phone, but when I do, it's always on silent.",
      "My bed is a magical place where I suddenly remember everything I was supposed to do.",
      "I love the sound you make when you shut up.",
      "I'm not arguing, I'm just explaining why I'm right.",
      "I'm not a complete idiot, some parts are missing.",
      "When life gives you lemons, squirt someone in the eye.",
      "I don't need anger management. You just need to stop making me angry.",
      "I'm not saying I'm Batman. I'm just saying no one has ever seen me and Batman in the same room together.",
      "I'm not saying I'm Superman. I'm just saying no one has ever seen me and Superman in the same room together.",
      "I'm not saying I'm Spider-Man. I'm just saying no one has ever seen me and Spider-Man in the same room together.",
      "I'm not saying I'm a superhero. I'm just saying no one has ever seen me and a superhero in the same room together.",
      "The early bird can have the worm because worms are gross and mornings are stupid.",
      "If life gives you lemons, make lemonade. Then find someone whose life has given them vodka and have a party!",
      "The road to success is always under construction.",
      "I am so clever that sometimes I don't understand a single word of what I am saying.",
      "Some people just need a high-five. In the face. With a chair.",
      "I'm not saying I'm perfect, but I'm pretty close.",
      "A day without sunshine is like, you know, night.",
      "The best way to predict the future is to create it.",
      "If you can't be a good example, then you'll just have to be a horrible warning.",
      "I don't know why I keep hitting the escape button. I'm just trying to get out of here.",
      "I'm not lazy. I'm on energy-saving mode.",
      "I don't need a hairstylist, my pillow gives me a new hairstyle every morning.",
      "I don't have a bad handwriting, I have my own font.",
      "I'm not clumsy. It's just the floor hates me, the table and chairs are bullies, and the walls get in my way.",
      "I'm not saying I'm Batman. I'm just saying no one has ever seen me and Batman in the same room together.",
      "I'm not saying I'm Wonder Woman. I'm just saying no one has ever seen me and Wonder Woman in the same room together.",
      "I'm not saying I'm Superman. I'm just saying no one has ever seen me and Superman in the same room together.",
      "I'm not saying I'm Spider-Man. I'm just saying no one has ever seen me and Spider-Man in the same room together.",
      "I'm not saying I'm a superhero. I'm just saying no one has ever seen me and a superhero in the same room together."
      ];
