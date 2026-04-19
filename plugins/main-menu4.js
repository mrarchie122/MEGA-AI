 import { createHash } from 'crypto'
import PhoneNumber from 'awesome-phonenumber'
import { canLevelUp, xpRange } from '../lib/levelling.js'
import fetch from 'node-fetch'
import fs from 'fs'
const { levelling } = '../lib/levelling.js'
import moment from 'moment-timezone'
import { promises } from 'fs'
import { join } from 'path'
const OwnerName = process.env.OWNER_NAME || 'QASIM ALI';
const BOTNAME = process.env.BOTNAME || 'ARCHIE-MD-WEB-BOT';
const timeZone = process.env.TIME_ZONE || 'Asia/Karachi';
const time = moment.tz(timeZone).format('HH')
let wib = moment.tz(timeZone).format('HH:mm:ss')


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
//import db from '../lib/database.js'

let handler = async (m, { conn, usedPrefix, command }) => {
  let d = new Date(new Date() + 3600000)
  let locale = 'en'
  let week = d.toLocaleDateString(locale, { weekday: 'long' })
  let date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  let _uptime = process.uptime() * 1000
  let uptime = clockString(_uptime)
  let who = m.quoted
    ? m.quoted.sender
    : m.mentionedJid && m.mentionedJid[0]
      ? m.mentionedJid[0]
      : m.fromMe
        ? (conn.user?.id || '')
        : m.sender
  if (!(who in global.db.data.users)) throw `✳️ The user is not found in my database`
  let pp = join(process.cwd(), 'assets', 'A.jpg')
  let user = global.db.data.users[who]
  let { name, exp, diamond, lastclaim, registered, regTime, age, level, role, warn } =
    global.db.data.users[who]
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
  let quote = quotes[Math.floor(Math.random() * quotes.length)]
  const done = '✅'

  let taguser = '@' + m.sender.split('@s.whatsapp.net')[0]
  let str = `
🚀 *_Buckle up ${name}, ${greeting}! We're going on an adventure!_* 🚀

📜 *_Quote of the day: ${quote}_* 📜

╭──❍「 *USER INFO* 」❍
├• 🦸 *Owner:* ${OwnerName}
├• 🏆 *Rank:* ${role}
├• 🎮 *XP:* ${exp} 
├• 🎩 *USER*:${username}
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *BOT STATUS* 」❍
├• 📆  *Date:* ${date}
├• ⏲️  *Time:* ${wib}
├• 🤡  *Bot:* ${BOTNAME} 
├• 📣  *Prefix:* ${usedPrefix} 
├• 🕓  *Uptime:* ${uptime}
├• 💌  *Database:* ${rtotalreg} of ${totaluser} 
├• 📚  *Total Users:* ${totaluser}
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *BOT MENU* 」❍
◈ • *allmenu*
◈ • *alive*
◈ • *autoreact*
◈ • *blocklist*
◈ • *botinfo*
◈ • *donate*
◈ • *gita*
◈ • *groups*
◈ • *language*
◈ • *listmenu*
◈ • *listprem*
◈ • *listrent*
◈ • *menu*
◈ • *menu2*
◈ • *menu3*
◈ • *menu4*
◈ • *mrcs*
◈ • *owner*
◈ • *ping*
◈ • *quran*
◈ • *rentbot*
◈ • *runtime*
◈ • *server*
◈ • *speedtest*
◈ • *stoprent*
◈ • *uptime*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *AI MENU* 」❍
◈ • *ai*
◈ • *blackbox*
◈ • *blackpink*
◈ • *bro*
◈ • *chatgpt*
◈ • *fact*
◈ • *google*
◈ • *googleit*
◈ • *gimage*
◈ • *gpt4*
◈ • *travel*
◈ • *why*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *TEXTPRO MENU* 」❍
◈ • *3dsilver*
◈ • *balon*
◈ • *blackpink*
◈ • *color*
◈ • *circle*
◈ • *cubic*
◈ • *foggy*
◈ • *galaxy*
◈ • *galaxy2*
◈ • *gaming*
◈ • *gold*
◈ • *golden*
◈ • *gsilver*
◈ • *hacker*
◈ • *jewel*
◈ • *logomaker*
◈ • *matrix*
◈ • *metal*
◈ • *metallic*
◈ • *mascot*
◈ • *nigeria*
◈ • *papercut*
◈ • *sand*
◈ • *splat*
◈ • *snake*
◈ • *star*
◈ • *typo*
◈ • *wgalaxy*
◈ • *wings*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *IMAGEN MENU* 」❍
◈ • *animefy*
◈ • *cartoon*
◈ • *dalle*
◈ • *hercai-lexica*
◈ • *imagev3*
◈ • *lexica*
◈ • *prodia*
◈ • *raava*
◈ • *shonin*
◈ • *simurg*
◈ • *v2beta*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *OWNER MENU* 」❍
◈ • *addowner*
◈ • *addprem*
◈ • *addsudo*
◈ • *afk*
◈ • *allow*
◈ • *allvars*
◈ • *autoeract*
◈ • *banchat*
◈ • *ban*
◈ • *banuser*
◈ • *broadcast*
◈ • *broadcastgc*
◈ • *clearchat*
◈ • *cleartmp*
◈ • *delcmd*
◈ • *delowner*
◈ • *delprem*
◈ • *delsudo*
◈ • *enable*
◈ • *fakereply*
◈ • *fullpp*
◈ • *getfile*
◈ • *getmsg*
◈ • *getplugin*
◈ • *intro*
◈ • *inspect*
◈ • *join*
◈ • *listban*
◈ • *listcmd*
◈ • *listplugins*
◈ • *logout*
◈ • *readviewonce*
◈ • *remove*
◈ • *restart*
◈ • *save*
◈ • *savecontact*
◈ • *savefile*
◈ • *setppbot*
◈ • *setprefix*
◈ • *setprivacy*
◈ • *unban*
◈ • *unbanuser*
◈ • *unbanchat*
◈ • *update*
◈ • *var*
◈ • *resetprefix*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *RANDOM PIC* 」❍
◈ • *aesthetic*
◈ • *antiwork*
◈ • *bike*
◈ • *blackpink3*
◈ • *boneka*
◈ • *car*
◈ • *cat*
◈ • *chinese*
◈ • *cosplay2*
◈ • *doggo*
◈ • *girl*
◈ • *hijab*
◈ • *indo*
◈ • *japanese*
◈ • *justina*
◈ • *kayes*
◈ • *korean*
◈ • *kpop*
◈ • *malay*
◈ • *malaysia*
◈ • *notnot*
◈ • *person*
◈ • *profile2*
◈ • *pubg*
◈ • *random*
◈ • *random2*
◈ • *ryujin*
◈ • *thai*
◈ • *ulzzanggirl*
◈ • *ulzzangboy*
◈ • *vietnamese*
◈ • *wallhp*
◈ • *wallml*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *RANDOM VIDEO* 」❍
◈ • *tiktokbocil*
◈ • *tiktokgirl*
◈ • *tiktokghea*
◈ • *tiktokkayes*
◈ • *tiktoknukhty*
◈ • *tiktoknotnot*
◈ • *tiktokpanrika*
◈ • *tiktoksantuy*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *GROUP MENU* 」❍
◈ • *add*
◈ • *admins*
◈ • *antilink*
◈ • *delete*
◈ • *demote*
◈ • *disable*
◈ • *enable*
◈ • *group*
◈ • *groupinfo*
◈ • *kick*
◈ • *link*
◈ • *mysn*
◈ • *notify*
◈ • *poll*
◈ • *promote*
◈ • *register*
◈ • *resetlink*
◈ • *setbye*
◈ • *setdesc*
◈ • *setname*
◈ • *setpp*
◈ • *setwelcome*
◈ • *ship*
◈ • *tagall*
◈ • *totag*
◈ • *warn*
◈ • *warns*
◈ • *unreg*
◈ • *unwarn*
◈ • *wyr*
◈ • *toxic*
◈ • *delwarn*
◈ • *hidetag*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *DOWNLOAD M* 」❍
◈ • *apkdl*
◈ • *apksearch*
◈ • *audio*
◈ • *capcut*
◈ • *dlstatus*
◈ • *facebook*
◈ • *gdrive*
◈ • *gimage*
◈ • *gitclone*
◈ • *githubdl*
◈ • *githubstalk*
◈ • *igstory*
◈ • *igstalk*
◈ • *insta*
◈ • *itunes*
◈ • *likee*
◈ • *mediafire*
◈ • *mega*
◈ • *npmstalk*
◈ • *pinterest*
◈ • *pinterest2*
◈ • *play*
◈ • *play2*
◈ • *play5*
◈ • *playstore*
◈ • *playvid*
◈ • *ringtone*
◈ • *rnekos*
◈ • *rwall*
◈ • *swdl*
◈ • *threads*
◈ • *tiktok*
◈ • *ttstalk*
◈ • *twitter*
◈ • *video*
◈ • *wallpapers*
◈ • *ytmp3*
◈ • *ytmp4*
◈ • *ytsearch*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *ECONOMY MENU* 」❍
◈ • *addgold*
◈ • *addxp*
◈ • *adventure*
◈ • *balance*
◈ • *bank*
◈ • *bet*
◈ • *buyall*
◈ • *buych*
◈ • *claim/daily*
◈ • *craft*
◈ • *deposit*
◈ • *give*
◈ • *heal*
◈ • *leaderboard*
◈ • *levelup*
◈ • *mine*
◈ • *monthly*
◈ • *opencrate*
◈ • *rob*
◈ • *sell*
◈ • *shop*
◈ • *todiamond*
◈ • *tomoney*
◈ • *transfer*
◈ • *wallet*
◈ • *weekly*
◈ • *withdraw*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *FUN MENU* 」❍
◈ • *alexa*
◈ • *character*
◈ • *dare*
◈ • *flirt*
◈ • *gay*
◈ • *hack*
◈ • *hornycard*
◈ • *lolicon*
◈ • *shayeri*
◈ • *simpcard*
◈ • *ship*
◈ • *stupid*
◈ • *truth*
◈ • *waste*
◈ • *ytcomment*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *REACTIONS M* 」❍
◈ • *awoo*
◈ • *bite*
◈ • *blush*
◈ • *bonk*
◈ • *bully*
◈ • *cringe*
◈ • *cry*
◈ • *cuddle*
◈ • *dance*
◈ • *glomp*
◈ • *happy*
◈ • *handhold*
◈ • *highfive*
◈ • *hug*
◈ • *kill*
◈ • *kiss*
◈ • *lick*
◈ • *nom*
◈ • *poke*
◈ • *pat*
◈ • *smug*
◈ • *slap*
◈ • *wave*
◈ • *wink*
◈ • *yeet*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *ANIME MENU* 」❍
◈ • *akira*
◈ • *akiyama*
◈ • *anna*
◈ • *asuna*
◈ • *ayuzawa*
◈ • *boruto*
◈ • *chiho*
◈ • *chitoge*
◈ • *couplepp*
◈ • *deidara*
◈ • *elaina*
◈ • *emilia*
◈ • *erza*
◈ • *hestia*
◈ • *hinata*
◈ • *hornycard*
◈ • *inori*
◈ • *itachi*
◈ • *kagura*
◈ • *kaori*
◈ • *keneki*
◈ • *kotori*
◈ • *loli*
◈ • *madara*
◈ • *mikasa*
◈ • *minato*
◈ • *miku*
◈ • *naruto*
◈ • *neko*
◈ • *nezuko*
◈ • *sagiri*
◈ • *sakura*
◈ • *sasuke*
◈ • *toanime*
◈ • *waifu*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *ANIME INFO* 」❍
◈ • *anime akira*
◈ • *anime akiyama*
◈ • *anime anna*
◈ • *anime asuna*
◈ • *anime ayuzawa*
◈ • *anime boruto*
◈ • *anime chiho*
◈ • *anime chitoge*
◈ • *anime deidara*
◈ • *anime elaina*
◈ • *anime emilia*
◈ • *anime erza*
◈ • *anime hestia*
◈ • *anime hinata*
◈ • *anime inori*
◈ • *anime isuzu*
◈ • *anime itachi*
◈ • *anime kagura*
◈ • *anime kaori*
◈ • *anime keneki*
◈ • *anime kotori*
◈ • *anime loli*
◈ • *anime madara*
◈ • *anime mikasa*
◈ • *anime minato*
◈ • *anime miku*
◈ • *anime naruto*
◈ • *anime neko*
◈ • *anime nezuko*
◈ • *anime sakura*
◈ • *anime sagiri*
◈ • *anime sasuke*
◈ • *anime waifu*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *GAME MENU* 」❍
◈ • *casino*
◈ • *chess*
◈ • *cock-fight*
◈ • *delttt*
◈ • *fhint*
◈ • *guessflag*
◈ • *math*
◈ • *math answer*
◈ • *ppt*
◈ • *roulette*
◈ • *slot*
◈ • *tictactoe*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *STICKER MENU* 」❍
◈ • *attp*
◈ • *attp2*
◈ • *attp3*
◈ • *emojimix*
◈ • *getsticker*
◈ • *quote*
◈ • *quoted*
◈ • *rc*
◈ • *scircle*
◈ • *s*
◈ • *smaker*
◈ • *smeme*
◈ • *stickers*
◈ • *take*
◈ • *tenor*
◈ • *tgsticker*
◈ • *toimg*
◈ • *tovid*
◈ • *trigger*
◈ • *ttp*
◈ • *ttp2*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *TOOLS MENU* 」❍
◈ • *android*
◈ • *autosticker*
◈ • *base64*
◈ • *calc*
◈ • *carbon*
◈ • *checkmail*
◈ • *course*
◈ • *define*
◈ • *element*
◈ • *enhance*
◈ • *fancy*
◈ • *filelength*
◈ • *google*
◈ • *googleit*
◈ • *happymod*
◈ • *imdb*
◈ • *itunes*
◈ • *linux*
◈ • *lyrics*
◈ • *nowa*
◈ • *pokedex*
◈ • *qrmaker*
◈ • *quote*
◈ • *readmore*
◈ • *readqr*
◈ • *readvo*
◈ • *reddit*
◈ • *removebg*
◈ • *remini*
◈ • *ssweb*
◈ • *styletext*
◈ • *technews*
◈ • *tinyurl*
◈ • *tocartoon*
◈ • *topdf*
◈ • *tourl*
◈ • *trace*
◈ • *translate*
◈ • *true*
◈ • *wa*
◈ • *weather*
◈ • *whatmusic*
◈ • *wattpad*
◈ • *wikipedia*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *AUDIO EDITOR* 」❍
◈ • *bass*
◈ • *blown*
◈ • *chipmunk*
◈ • *deep*
◈ • *earrape*
◈ • *fast*
◈ • *nightcore*
◈ • *reverse*
◈ • *robot*
◈ • *slow*
◈ • *smooth*
◈ • *squirrel*
◈ • *tupai*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *NSFW MENU* 」❍
◈ • *genshin*
◈ • *swimsuit*
◈ • *schoolswimsuit*
◈ • *white*
◈ • *barefoot*
◈ • *touhou*
◈ • *gamecg*
◈ • *hololive*
◈ • *uncensored*
◈ • *sunglasses*
◈ • *glasses*
◈ • *weapon*
◈ • *shirtlift*
◈ • *chain*
◈ • *fingering*
◈ • *flatchest*
◈ • *torncloth*
◈ • *bondage*
◈ • *demon*
◈ • *wet*
◈ • *pantypull*
◈ • *headdress*
◈ • *headphone*
◈ • *tie*
◈ • *anusview*
◈ • *shorts*
◈ • *stokings*
◈ • *topless*
◈ • *beach*
◈ • *bunnygirl*
◈ • *bunnyear*
◈ • *idol*
◈ • *vampire*
◈ • *gun*
◈ • *maid*
◈ • *bra*
◈ • *nobra*
◈ • *bikini*
◈ • *whitehair*
◈ • *blonde*
◈ • *pinkhair*
◈ • *bed*
◈ • *ponytail*
◈ • *nude*
◈ • *dress*
◈ • *underwear*
◈ • *foxgirl*
◈ • *uniform*
◈ • *skirt*
◈ • *sex*
◈ • *sex2*
◈ • *sex3*
◈ • *breast*
◈ • *twintail*
◈ • *spreadpussy*
◈ • *tears*
◈ • *seethrough*
◈ • *breasthold*
◈ • *drunk*
◈ • *fateseries*
◈ • *spreadlegs*
◈ • *openshirt*
◈ • *headband*
◈ • *food*
◈ • *close*
◈ • *tree*
◈ • *nipples*
◈ • *erectnipples*
◈ • *horns*
◈ • *greenhair*
◈ • *wolfgirl*
◈ • *catgirl*
◈ • *nsfw*
◈ • *ass*
◈ • *boobs*
◈ • *lesbian*
◈ • *pussy*
◈ • *pack*
╰─┬─★─☆─♪♪─❍
╭─┴❍「 *MAKER MENU* 」❍
◈ • *blur*
◈ • *difuminar2*
◈ • *enhance*
◈ • *gfx1*
◈ • *gfx10*
◈ • *gfx11*
◈ • *gfx12*
◈ • *gfx2*
◈ • *gfx3*
◈ • *gfx4*
◈ • *gfx5*
◈ • *gfx6*
◈ • *gfx7*
◈ • *gfx8*
◈ • *gfx9*
◈ • *hornycard*
◈ • *hornylicense*
◈ • *itssostupid*
◈ • *iss*
◈ • *lolicon*
◈ • *logololi*
◈ • *simpcard*
◈ • *stupid*
◈ • *tweet <comment>*
◈ • *ytcomment <comment>*
╰───★─☆─♪♪─❍

`

  str = styleMenuCommands(str, usedPrefix)

  conn.sendFile(m.chat, pp, 'perfil.jpg', str, m, null, {
    ...MENU_NEWSLETTER_INFO,
    mentions: [m.sender],
    contextInfo: {
      ...MENU_NEWSLETTER_INFO.contextInfo,
      mentionedJid: [m.sender],
    },
  })
  m.react(done)
}
handler.help = ['main']
handler.tags = ['group']
handler.command = ['menu', 'help', 'h', 'commands', 'menu4', 'help4', 'allmenu', 'fullmenu']

export default handler
function clockString(ms) {
  let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
  let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
  let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}

function ucapan() {
  const timeZone = process.env.TIME_ZONE || 'Asia/Karachi';
  const time = moment.tz(timeZone).format('HH')
  let res = 'happy early in the day☀️'
  if (time >= 4) {
    res = 'Good Morning 🌄'
  }
  if (time >= 10) {
    res = 'Good Afternoon ☀️'
  }
  if (time >= 15) {
    res = 'Good Afternoon 🌇'
  }
  if (time >= 18) {
    res = 'Good Night 🌙'
  }
  return res
}
const quotes = [
  "I'm not lazy, I'm just on my energy saving mode.",
  'Life is short, smile while you still have teeth.',
  'I may be a bad influence, but darn I am fun!',
  "I'm on a whiskey diet. I've lost three days already.",
  "Why don't some couples go to the gym? Because some relationships don't work out.",
  'I told my wife she should embrace her mistakes... She gave me a hug.',
  "I'm great at multitasking. I can waste time, be unproductive, and procrastinate all at once.",
  "You know you're getting old when you stoop to tie your shoelaces and wonder what else you could do while you're down there.",
  "I'm so good at sleeping, I can do it with my eyes closed.",
  'If you think nobody cares if you’re alive, try missing a couple of payments.',
  "I used to think I was indecisive, but now I'm not so sure.",
  "If you can't convince them, confuse them.",
  'I told my wife she was drawing her eyebrows too high. She looked surprised.',
  "I'm not clumsy, I'm just on a mission to test gravity.",
  "I told my wife she should do more push-ups. She said, 'I could do a hundred!' So I counted to ten and stopped.",
  "Life is like a box of chocolates; it doesn't last long if you're hungry.",
  "I'm not saying I'm Wonder Woman, I'm just saying no one has ever seen me and Wonder Woman in the same room together.",
  'Why do they call it beauty sleep when you wake up looking like a troll?',
  "I don't always lose my phone, but when I do, it's always on silent.",
  'My bed is a magical place where I suddenly remember everything I was supposed to do.',
  'I love the sound you make when you shut up.',
  "I'm not arguing, I'm just explaining why I'm right.",
  "I'm not a complete idiot, some parts are missing.",
  'When life gives you lemons, squirt someone in the eye.',
  "I don't need anger management. You just need to stop making me angry.",
  "I'm not saying I'm Batman. I'm just saying no one has ever seen me and Batman in the same room together.",
  "I'm not saying I'm Superman. I'm just saying no one has ever seen me and Superman in the same room together.",
  "I'm not saying I'm Spider-Man. I'm just saying no one has ever seen me and Spider-Man in the same room together.",
  "I'm not saying I'm a superhero. I'm just saying no one has ever seen me and a superhero in the same room together.",
  'The early bird can have the worm because worms are gross and mornings are stupid.',
  'If life gives you lemons, make lemonade. Then find someone whose life has given them vodka and have a party!',
  'The road to success is always under construction.',
  "I am so clever that sometimes I don't understand a single word of what I am saying.",
  'Some people just need a high-five. In the face. With a chair.',
  "I'm not saying I'm perfect, but I'm pretty close.",
  'A day without sunshine is like, you know, night.',
  'The best way to predict the future is to create it.',
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
  "I'm not saying I'm a superhero. I'm just saying no one has ever seen me and a superhero in the same room together.",
]
