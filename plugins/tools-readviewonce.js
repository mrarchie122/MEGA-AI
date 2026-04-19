var handler = async (m, { conn }) => {
  if (!m.quoted) throw '✳️❇️ Reply to a ViewOnce Message'
  if (!m.quoted?.message) throw '✳️❇️ Invalid message type'

  const quotedMessage = m.quoted.message
  const embeddedMessage =
    quotedMessage.viewOnceMessageV2?.message ||
    quotedMessage.viewOnceMessage?.message ||
    quotedMessage.viewOnceMessageV2Extension?.message ||
    quotedMessage

  const messageType = Object.keys(embeddedMessage || {})[0]
  const messageContent = messageType ? embeddedMessage[messageType] : null

  if (!messageType || !messageContent?.viewOnce) {
    throw '✳️❇️ This is Not a ViewOnce Message'
  }

  try {
    if (typeof conn.copyNForward === 'function') {
      await conn.copyNForward(m.chat, m.quoted, false, { readViewOnce: true })
      return
    }

    const mediaType = messageType.replace(/Message$/, '')
    const buffer = await m.quoted.download()
    await conn.sendMessage(
      m.chat,
      {
        [mediaType]: buffer,
        caption: messageContent.caption || '',
        mimetype: messageContent.mimetype,
      },
      { quoted: m }
    )
  } catch (error) {
    throw `Failed to download viewOnce: ${error.message}`
  }
}

handler.help = ['readvo']
handler.tags = ['tools']
handler.command = ['readviewonce', 'read', 'vv', 'readvo']

export default handler
