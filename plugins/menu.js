import moment from 'moment-timezone';
import { xpRange } from '../lib/levelling.js';

let handler = async (m, { conn, usedPrefix }) => {
    let d = new Date(new Date() + 3600000);
    let locale = 'en';
    let date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    let _uptime = process.uptime() * 1000;
    let uptime = clockString(_uptime);

    let who = m.quoted ? m.quoted.sender : m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? (conn.user?.id || '') : m.sender;
    if (!(who in global.db.data.users)) throw `✳️ The user is not found in my database`;

    let user = global.db.data.users[who];
    let { level } = user;
    let { min, xp, max } = xpRange(level, global.multiplier);
    let greeting = ucapan();

    let str = `*『 ARCHIE-MD-WEB-BOT MENU 』*

${greeting}
📅 Date: ${date}
⏱️ Uptime: ${uptime}
📈 Level: ${level}
✨ XP: ${xp - min}/${max - min}

*Main Menus*
• ${usedPrefix}botmenu
• ${usedPrefix}ownermenu
• ${usedPrefix}aimenu
• ${usedPrefix}aeditor
• ${usedPrefix}animemenu
• ${usedPrefix}infoanime
• ${usedPrefix}groupmenu
• ${usedPrefix}dlmenu
• ${usedPrefix}funmenu
• ${usedPrefix}economymenu
• ${usedPrefix}gamemenu
• ${usedPrefix}stickermenu
• ${usedPrefix}fancy
• ${usedPrefix}toolmenu
• ${usedPrefix}logomenu
• ${usedPrefix}fancy2
• ${usedPrefix}nsfwmenu

Tip: use ${usedPrefix}menu2 for alternate style.`;

    await conn.reply(m.chat, str.trim(), m);
}

handler.help = ['main'];
handler.tags = ['group'];
handler.command = ['menuclassic', 'legacymenu', 'classichelp'];

export default handler;

function clockString(ms) {
    let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000);
    let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
    let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
    return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':');
}

function ucapan() {
    const time = moment.tz('Asia/Karachi').format('HH');
    let res = "happy early in the day☀️";
    if (time >= 4) {
        res = "Good Morning 🥱";
    }
    if (time >= 10) {
        res = "Good Afternoon 🫠";
    }
    if (time >= 15) {
        res = "Good Afternoon 🌇";
    }
    if (time >= 18) {
        res = "Good Night 🌙";
    }
    return res;
}
