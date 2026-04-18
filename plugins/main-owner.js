let handler = async (m, { conn }) => {
  if (!conn) {
    console.error('Connection object is undefined');
    return;
  }

  const ownerNumber = String(global.owner?.[0]?.[0] || process.env.OWNERS || '923444844060').replace(/\D/g, '');
  const ownerName = process.env.OWNER_NAME || global.ownername || 'ARCHIE TECH NEXUS';
  const ownerLink = process.env.OWNER_LINK || global.ownerlink || 'https://wa.me/254102696488';

  const vcard = `BEGIN:VCARD
VERSION:3.0
N:;${ownerName};;;
FN:${ownerName}
ORG:ARCHIETECH NEXUS
TITLE:Owner
item1.URL:${ownerLink}
item1.X-ABLabel:Contact
item2.TEL;waid=${ownerNumber}:${ownerNumber}
item2.X-ABLabel:WhatsApp
END:VCARD`;

  await conn.sendMessage(m.chat, {
    text: `Owner Contact:\n${ownerLink}`,
    contacts: {
      displayName: ownerName,
      contacts: [{ vcard }],
    },
  }, { quoted: m });
}

handler.help = ['owner'];
handler.tags = ['main'];
handler.command = ['owner'];

export default handler;
