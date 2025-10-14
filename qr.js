const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers
} = require('@whiskeysockets/baileys');
const { upload } = require('./mega');

const router = express.Router();

function removeFile(FilePath) {
  if (fs.existsSync(FilePath)) {
    fs.rmSync(FilePath, { recursive: true, force: true });
  }
}

router.get('/', async (req, res) => {
  const id = makeid();

  async function ALI_MD_QR() {
    const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
    try {
      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' }))
        },
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        logger: pino({ level: 'error' }),
        syncFullHistory: false,
        browser: Browsers.macOS('Safari')
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // ✅ Send QR as image safely
        if (qr && !res.headersSent) {
          const qrBuffer = await QRCode.toBuffer(qr);
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(qrBuffer);
        }

        if (connection === 'open') {
          await delay(4000);

          const rf = __dirname + `/temp/${id}/creds.json`;
          if (!fs.existsSync(rf)) return;

          try {
            // 🔐 Upload creds to MEGA
            const mega_url = await upload(fs.createReadStream(rf), `${sock.user.id}.json`);
            const string_session = mega_url.replace('https://mega.nz/file/', '');
            const session_id = 'ALI-MD~' + string_session;

            // 💬 Send session ID to user
            const codeMsg = await sock.sendMessage(sock.user.id, { text: session_id });

            // 📢 Send info/thanks message
            const desc = `*ʜᴇʏ ᴛʜᴇʀᴇ, ᴀʟɪ-ᴍᴅ ʙᴏᴛ ᴜsᴇʀ!* 👋🏻

*🔐 ʏᴏᴜʀ sᴇssɪᴏɴ ɪᴅ ɪs ʀᴇᴀᴅʏ!*
*⚠️ ᴋᴇᴇᴘ ɪᴛ sᴀғᴇ! ᴅᴏ ɴᴏᴛ sʜᴀʀᴇ ᴛʜɪs ɪᴅ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ.*

 *🪀 ᴄʜᴀɴɴᴇʟ:*  
*https://whatsapp.com/channel/0029VaoRxGmJpe8lgCqT1T2h*

 *🖇️ ʀᴇᴘᴏ:*
*https://github.com/ALI-INXIDE/ALI-MD*

> *© ᴘσωєʀє∂ ву αℓι м∂⎯꯭̽💀🚩*`;

            await sock.sendMessage(
              sock.user.id,
              {
                text: desc,
                contextInfo: {
                  externalAdReply: {
                    title: '𝐒𝐄𝐒𝐒𝐈𝐎𝐍 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 🎀',
                    thumbnailUrl: 'https://files.catbox.moe/zauvq6.jpg',
                    sourceUrl: 'https://whatsapp.com/channel/0029VaoRxGmJpe8lgCqT1T2h',
                    mediaType: 1,
                    renderLargerThumbnail: true
                  }
                }
              },
              { quoted: codeMsg }
            );
          } catch (err) {
            console.error('Upload error:', err);
            await sock.sendMessage(sock.user.id, { text: `❗ Error uploading session:\n${err}` });
          } finally {
            // Cleanup
            removeFile('./temp/' + id);
            if (sock?.ws) sock.ws.close();
            console.log(`✅ ${sock.user.id} connected & cleaned.`);
          }
        } else if (connection === 'close' && lastDisconnect?.error?.output?.statusCode != 401) {
          console.log('Connection closed, restarting...');
          ALI_MD_QR();
        }
      });
    } catch (err) {
      console.error('Main error:', err);
      removeFile('./temp/' + id);
      if (!res.headersSent) res.status(500).send({ code: '❗ Service Unavailable' });
    }
  }

  await ALI_MD_QR();
});

// 🕐 Optional safety restart (3 hours)
setInterval(() => {
  console.log('♻️ Restarting process for stability...');
  process.exit(0);
}, 10800000);

module.exports = router;
