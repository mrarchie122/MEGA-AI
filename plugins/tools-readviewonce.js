var handler = async (m, { conn }) => {
  if (!m.quoted) throw "✳️❇️ Reply to a ViewOnce Message"

  const pickQuotedContainer = quoted =>
    quoted?.message || quoted?.fakeObj?.message || quoted?.quoted?.message || null

  const unwrapViewOnceMessage = message => {
    if (!message || typeof message !== "object") return null
    if (message.viewOnceMessageV2?.message) return message.viewOnceMessageV2.message
    if (message.viewOnceMessage?.message) return message.viewOnceMessage.message
    if (message.viewOnceMessageV2Extension?.message) return message.viewOnceMessageV2Extension.message
    if (message.ephemeralMessage?.message) return unwrapViewOnceMessage(message.ephemeralMessage.message)
    return null
  }

  const quotedMessage = pickQuotedContainer(m.quoted)
  const embeddedMessage = unwrapViewOnceMessage(quotedMessage)

  // Some serializers expose only m.quoted.msg / m.quoted.mtype without raw wrappers.
  const directType = m.quoted?.mtype
  const directContent = m.quoted?.msg

  const messageType =
    (embeddedMessage && Object.keys(embeddedMessage)[0]) ||
    (directContent?.viewOnce ? directType : null)
  const messageContent =
    (embeddedMessage && messageType ? embeddedMessage[messageType] : null) ||
    (directContent?.viewOnce ? directContent : null)

  if (!messageType || !messageContent) throw "✳️❇️ This is Not a ViewOnce Message"

  try {
    // copyNForward(readViewOnce) here expects a legacy viewOnceMessage wrapper.
    const forwardSource = m.quoted?.fakeObj || m.quoted
    if (
      typeof conn.copyNForward === "function" &&
      forwardSource?.message?.viewOnceMessage?.message
    ) {
      await conn.copyNForward(m.chat, forwardSource, false, { readViewOnce: true })
      return
    }

    const mediaType = messageType.replace(/Message$/, "")
    if (typeof m.quoted?.download !== "function") {
      throw new Error("quoted media is not downloadable")
    }

    const buffer = await m.quoted.download()
    await conn.sendMessage(
      m.chat,
      {
        [mediaType]: buffer,
        caption: messageContent.caption || "",
        mimetype: messageContent.mimetype,
      },
      { quoted: m }
    )
  } catch (error) {
    throw `Failed to download viewOnce: ${error.message}`
  }
}

handler.help = ["readvo"]
handler.tags = ["tools"]
handler.command = ["readviewonce", "read", "vv", "readvo"]

export default handler
