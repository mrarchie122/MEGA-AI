let handler = async (m, { conn, usedPrefix }) => {
  let who = m.quoted
    ? m.quoted.sender
    : m.mentionedJid && m.mentionedJid[0]
      ? m.mentionedJid[0]
      : m.fromMe
        ? (conn.user?.id || '')
        : m.sender
  let user = global.db.data.users[who]
  let username = conn.getName(who)
  //let { wealth } = global.db.data.users[who]
  if (!(who in global.db.data.users)) throw `✳️ The user is not found in my database`

  var wealth = 'Broke😭'
  if (`${user.bank}` <= 3000) {
    wealth = 'Broke😭'
  } else if (`${user.bank}` <= 6000) {
    wealth = 'Poor😢'
  } else if (`${user.bank}` <= 100000) {
    wealth = 'Average💸'
  } else if (`${user.bank}` <= 1000000) {
    wealth = 'Rich💸💰'
  } else if (`${user.bank}` <= 10000000) {
    wealth = 'Millionaire🤑'
  } else if (`${user.bank}` <= 1000000000) {
    wealth = 'Multi-Millionaire🤑'
  } else if (`${user.bank}` <= 10000000000) {
    wealth = 'Billionaire🤑🤑'
  }

  conn.reply(
    m.chat,
    `🏦 *Bank | ${username}*

*🪙 Gold* : ${user.bank}

*Wealth :* ${wealth}

`,
    m,
    { mentions: [who] }
  ) //${user.chicken}
}
handler.help = ['bank']
handler.tags = ['economy']
handler.command = ['bank', 'vault']

export default handler
