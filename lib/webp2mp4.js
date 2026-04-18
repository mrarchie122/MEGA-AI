import fetch from 'node-fetch'
import { FormData, Blob } from 'formdata-node'
import { load } from 'cheerio'
/**
 *
 * @param {Buffer|String} source
 */
async function webp2mp4(source) {
  let form = new FormData()
  let isUrl = typeof source === 'string' && /https?:\/\//.test(source)
  const blob = !isUrl && new Blob([source.toArrayBuffer()])
  form.append('new-image-url', isUrl ? blob : '')
  form.append('new-image', isUrl ? '' : blob, 'image.webp')
  let res = await fetch('https://ezgif.com/webp-to-mp4', {
    method: 'POST',
    body: form,
  })
  let html = await res.text()
  let $ = load(html)
  let form2 = new FormData()
  let obj = {}
  $('form input[name]').each((_, el) => {
    const input = $(el)
    const name = input.attr('name')
    const value = input.attr('value') || ''
    if (!name) return
    obj[name] = value
    form2.append(name, value)
  })
  let res2 = await fetch('https://ezgif.com/webp-to-mp4/' + obj.file, {
    method: 'POST',
    body: form2,
  })
  let html2 = await res2.text()
  let $2 = load(html2)
  const src = $2('div#output > p.outfile > video > source').attr('src')
  if (!src) throw new Error('Failed to parse mp4 output URL')
  return new URL(src, res2.url).toString()
}

async function webp2png(source) {
  let form = new FormData()
  let isUrl = typeof source === 'string' && /https?:\/\//.test(source)
  const blob = !isUrl && new Blob([source.toArrayBuffer()])
  form.append('new-image-url', isUrl ? blob : '')
  form.append('new-image', isUrl ? '' : blob, 'image.webp')
  let res = await fetch('https://ezgif.com/webp-to-png', {
    method: 'POST',
    body: form,
  })
  let html = await res.text()
  let $ = load(html)
  let form2 = new FormData()
  let obj = {}
  $('form input[name]').each((_, el) => {
    const input = $(el)
    const name = input.attr('name')
    const value = input.attr('value') || ''
    if (!name) return
    obj[name] = value
    form2.append(name, value)
  })
  let res2 = await fetch('https://ezgif.com/webp-to-png/' + obj.file, {
    method: 'POST',
    body: form2,
  })
  let html2 = await res2.text()
  let $2 = load(html2)
  const src = $2('div#output > p.outfile > img').attr('src')
  if (!src) throw new Error('Failed to parse png output URL')
  return new URL(src, res2.url).toString()
}

export { webp2mp4, webp2png }
