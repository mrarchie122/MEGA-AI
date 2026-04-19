import { downloadContentFromMessage } from "@whiskeysockets/baileys"

function unwrapMessage(message = {}) {
  if (!message || typeof message !== "object") return null

  const nested =
    message.viewOnceMessageV2?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2Extension?.message ||
    message.ephemeralMessage?.message ||
    null

  return nested ? unwrapMessage(nested) : message
}

function extractMedia(message = {}) {
  const resolved = unwrapMessage(message) || {}

  if (resolved.imageMessage) return { type: "image", data: resolved.imageMessage }
  if (resolved.videoMessage) return { type: "video", data: resolved.videoMessage }

  return null
}

async function toBuffer(mediaData, mediaType) {
  const stream = await downloadContentFromMessage(mediaData, mediaType)
  let buffer = Buffer.from([])
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

var handler = async (m, { conn }) => {
  if (!m?.quoted) throw "Reply to a view-once image or video"

  const quotedMessage =
    m.quoted?.message ||
    m.quoted?.fakeObj?.message ||
    m.quoted?.quotedMessage ||
    (m.quoted?.mtype && m.quoted?.msg ? { [m.quoted.mtype]: m.quoted.msg } : {})

  const media = extractMedia(quotedMessage)
  if (!media) throw "Please reply to a view-once image or video"

  try {
    const buffer = await toBuffer(media.data, media.type)
    if (!buffer?.length) throw new Error("empty media buffer")

    const caption = media.data.caption || "Retrieved view-once media"
    await conn.sendMessage(
      m.chat,
      media.type === "video" ? { video: buffer, caption } : { image: buffer, caption },
      { quoted: m }
    )
  } catch (error) {
    throw "Failed to download viewOnce: " + (error?.message || String(error))
  }
}

handler.help = ["readvo"]
handler.tags = ["tools"]
handler.command = ["readviewonce", "read", "vv", "readvo", "viewonce", "rvo"]

export default handler
