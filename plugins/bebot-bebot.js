// Temporarily disabled: original file had syntax/runtime issues.
let handler = async m => {
  await m.reply('This feature is temporarily disabled for stability.')
}

handler.help = ['botclone']
handler.tags = ['bebot']
handler.command = ['botclone', 'bebot']
handler.rowner = true

export default handler
