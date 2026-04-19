import fetch from 'node-fetch';
import pkg from '../lib/nayan-downloader.js';
const { likee } = pkg;

const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    console.log(`Retrying... (${i + 1})`);
  }
  throw new Error('Failed to fetch media content after retries');
};

const handler = async (m, { conn, args }) => {
  if (!args[0]) throw `✳️ Enter the Likee video link next to the command`;
  
  const likeeRegex = /(likee\.app|likee\.com|likee\.tv|lite\.likeevideo\.com|l\.likee\.video)/;
  if (!args[0].match(likeeRegex)) {
    throw `❌ Link incorrect`;
  }
  
  m.react('⏳');

  try {
    const url = args[0];
    console.log('URL:', url);

    let mediaData = await likee(url);
    console.log('Media Data:', mediaData);

    if (!mediaData.status || mediaData.status !== 200) {
      throw new Error(`Error: ${mediaData.msg}`);
    }

    const downloadUrl = mediaData.data.withoutwatermark;
    if (!downloadUrl) throw new Error('Could not fetch the download URL');

    console.log('Download URL:', downloadUrl);

    const response = await fetchWithRetry(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36'
      }
    });

    console.log('Response Headers:', response.headers);

    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);

    if (!contentType || 
        (!contentType.includes('video') && 
        !contentType.includes('octet-stream') && 
        !contentType.includes('mp4'))) {
      throw new Error('Invalid content type received');
    }

    const arrayBuffer = await response.arrayBuffer();
    const mediaBuffer = Buffer.from(arrayBuffer);

    if (mediaBuffer.length === 0) throw new Error('Downloaded file is empty');

    const fileName = mediaData.data.title ? `${mediaData.data.title}.mp4` : 'media.mp4';
    const mimetype = 'video/mp4';

    await conn.sendFile(m.chat, mediaBuffer, fileName, `*𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 © 𝚄𝙻𝚃𝚁𝙰-𝙼𝙳*`, m, false, { mimetype });
    m.react('✅');
  } catch (error) {
    console.error('Error downloading from Likee:', error.message, error.stack);
    await m.reply('⚠️ An error occurred while processing the request. Please try again later.');
    m.react('❌');
  }
};

handler.help = ['likee <url>'];
handler.tags = ['downloader'];
handler.command = ['likee'];

export default handler;
