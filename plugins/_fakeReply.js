let handler = m => m
handler.all = async function (m) {
	let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? (this.user?.id || '') : m.sender
	
	//reply link wa
   global.rpgc = { contextInfo: { externalAdReply: { mediaUrl: 'https://i.ibb.co/GfD6jbqM/5987667264192318439-121.jpg', mediaType: 'VIDEO', description: 'support group', title: 'JOIN GROUP', body: 'support group', thumbnailUrl: 'https://i.ibb.co/GfD6jbqM/5987667264192318439-121.jpg', sourceUrl: 'https://whatsapp.com/channel/0029VagJIAr3bbVBCpEkAM07' }}} 
	
	//reply link owner contact 
    global.rpig = { contextInfo: { externalAdReply: { mediaUrl: 'https://i.ibb.co/GfD6jbqM/5987667264192318439-121.jpg', mediaType: 'VIDEO', description: 'OWNER CONTACT', title: 'OWNER', body: 'ARCHIETECH NEXUS', thumbnailUrl: 'https://i.ibb.co/GfD6jbqM/5987667264192318439-121.jpg', sourceUrl: 'https://wa.me/254102696488' }}}
	
	//reply link owner contact
	global.rpyt = { contextInfo: { externalAdReply: { showAdAttribution: true, mediaUrl: 'https://i.ibb.co/GfD6jbqM/5987667264192318439-121.jpg', mediaType: 'VIDEO', description: 'OWNER CONTACT', title: 'OWNER', body: 'ARCHIETECH NEXUS', thumbnailUrl: 'https://i.ibb.co/GfD6jbqM/5987667264192318439-121.jpg', sourceUrl: 'https://wa.me/254102696488' }}}

//reply link WhatsApp Channel
	global.rpwp = { contextInfo: { externalAdReply: { showAdAttribution: true, mediaUrl: 'https://i.ibb.co/GfD6jbqM/5987667264192318439-121.jpg', mediaType: 'VIDEO', description: 'Follow Channel', title: 'FOLLOW CHANNEL', body: '© ARCHIETECH NEXUS', thumbnailUrl: 'https://i.ibb.co/GfD6jbqM/5987667264192318439-121.jpg', sourceUrl: 'https://whatsapp.com/channel/0029Vb6dgrn3rZZXIpZFOz1x' }}}
    
} 
export default handler
