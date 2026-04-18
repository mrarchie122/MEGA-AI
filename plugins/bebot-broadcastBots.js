// Temporarily disabled: original file had syntax/runtime issues.
let handler = async m => {
  await m.reply('This feature is temporarily disabled for stability.')
}

handler.help = ['txbot']
handler.tags = ['bebot']
handler.command = ['txbot']
handler.rowner = true

export default handler
