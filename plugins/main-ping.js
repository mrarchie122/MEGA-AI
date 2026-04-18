import speed from 'performance-now'

let handler = async (m, { conn }) => {
  let fgg = {
    key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast' },
    message: {
      contactMessage: {
        displayName: 'ARCHIE-MD',
        vcard: 'BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:ARCHIE-MD\nitem1.TEL;waid=' + m.sender.split('@')[0] + ':' + m.sender.split('@')[0] + '\nitem1.X-ABLabel:Ponsel\nEND:VCARD',
      },
    },
  }
  let timestamp = speed()
  let pingMsg = await conn.sendMessage(m.chat, { text: 'Pinging...' }, { quoted: fgg })
  let latency = (speed() - timestamp).toFixed(4)

  await conn.sendMessage(m.chat, { text: '*ARCHIE-MD running ping:* *' + latency + ' ms*', edit: pingMsg.key })
}

handler.help = ['ping']
handler.tags = ['main']
handler.command = ['ping', 'speed']

export default handler
