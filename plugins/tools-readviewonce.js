var handler = async (m, { conn }) => {
  if (!m.quoted) throw 'Reply to a ViewOnce message'

  const pickQuotedContainer = quoted =>
    quoted?.message || quoted?.fakeObj?.message || quoted?.quoted?.message || null

  const unwrapViewOnceMessage = message => {
    if (!message || typeof message !== 'object') return null
    if (message.viewOnceMessageV2?.message) return message.viewOnceMessageV2.message
    if (message.viewOnceMessage?.message) return message.viewOnceMessage.message
    if (message.viewOnceMessageV2Extension?.message) return message.viewOnceMessageV2Extension.message
    if (message.ephemeralMessage?.message) return unwrapViewOnceMessage(message.ephemeralMessage.message)
    return null
  }

  const extractQuotedViewOnce = quoted => {
    const quotedMessage = pickQuotedContainer(quoted)
    const embedded = unwrapViewOnceMessage(quotedMessage)

    if (embedded && typeof embedded === 'object') {
      const mediaType = Object.keys(embedded)[0]
      const mediaNode = mediaType ? embedded[mediaType] : null
      if (mediaType && mediaNode) return { mediaType, mediaNode }
    }

    if (quoted?.viewOnce && quoted?.mtype && typeof quoted === 'object') {
      return { mediaType: quoted.mtype, mediaNode: quoted }
    }

    if (quoted?.msg?.viewOnce && quoted?.mtype && quoted?.msg) {
      return { mediaType: quoted.mtype, mediaNode: quoted.msg }
    }

    return null
  }

  const extracted = extractQuotedViewOnce(m.quoted)
  if (!extracted) throw 'This is not a ViewOnce message'

  try {
    const mediaType = extracted.mediaType
    const mediaNode = extracted.mediaNode
    const forwardSource = m.quoted?.fakeObj || m.quoted

    if (
      typeof conn.copyNForward === 'function' &&
      forwardSource?.message?.viewOnceMessage?.message
    ) {
      await conn.copyNForward(m.chat, forwardSource, false, { readViewOnce: true })
      return
    }

    const mediaKey = mediaType.replace(/Message$/, '').toLowerCase()
    const buffer = typeof conn.downloadM === 'function'
      ? await conn.downloadM(mediaNode, mediaKey, false)
      : typeof m.quoted?.download === 'function'
        ? await m.quoted.download()
        : Buffer.alloc(0)

    if (!buffer || !buffer.length) {
      throw new Error('unable to download quoted view-once media')
    }

    await conn.sendMessage(
      m.chat,
      {
        [mediaKey]: buffer,
        caption: mediaNode.caption || '',
        mimetype: mediaNode.mimetype,
      },
      { quoted: m }
    )
  } catch (error) {
    throw 'Failed to download viewOnce: ' + error.message
  }
}

handler.help = ['readvo']
handler.tags = ['tools']
handler.command = ['readviewonce', 'read', 'vv', 'readvo']

export default handler
