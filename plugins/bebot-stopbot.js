// Temporarily disabled: original file had syntax/runtime issues.
let handler = async m => {
  await m.reply('This feature is temporarily disabled for stability.')
}

handler.help = ['stopbebot']
handler.tags = ['bebot']
handler.command = ['stopbebot', 'stoprent']
handler.owner = true

export default handler
