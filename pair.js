const { makeid } = require("./gen-id");
const express = require("express");
const fs = require("fs");
let router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");

const { upload } = require("./mega");

function removeFile(FilePath) {
  try {
    if (fs.existsSync(FilePath)) {
      fs.rmSync(FilePath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error("removeFile error:", err);
  }
}

router.get("/", async (req, res) => {
  const id = makeid();
  let num = req.query.number;

  if (!num) {
    return res.status(400).send({ code: "❗ Missing number parameter" });
  }

  num = num.replace(/[^0-9]/g, "");

  async function ALI_MD_PAIR() {
    const { state, saveCreds } = await useMultiFileAuthState("./temp/" + id);

    try {
      const browserList = ["Safari", "Firefox", "Chrome"];
      const randomBrowser =
        browserList[Math.floor(Math.random() * browserList.length)];

      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" })
          ),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: Browsers.macOS(randomBrowser),
      });

      if (!sock.authState.creds.registered) {
        await delay(1500);
        const code = await sock.requestPairingCode(num);
        if (!res.headersSent) res.send({ code });
      }

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
          await delay(3000);
          const rf = `./temp/${id}/creds.json`;
          if (!fs.existsSync(rf)) return;

          try {
            const mega_url = await upload(
              fs.createReadStream(rf),
              `${sock.user.id}.json`
            );
            const string_session = mega_url.replace(
              "https://mega.nz/file/",
              ""
            );
            const md = "ALI-MD~" + string_session;

            const codeMsg = await sock.sendMessage(sock.user.id, { text: md });

            const desc = `**ʜᴇʏ ᴛʜᴇʀᴇ, ᴀʟɪ-ᴍᴅ ʙᴏᴛ ᴜsᴇʀ!* 👋🏻

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
                    title: "𝐒𝐄𝐒𝐒𝐈𝐎𝐍 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 🎀",
                    thumbnailUrl: "https://files.catbox.moe/zauvq6.jpg",
                    sourceUrl:
                      "https://whatsapp.com/channel/0029VaoRxGmJpe8lgCqT1T2h",
                    mediaType: 1,
                    renderLargerThumbnail: true,
                  },
                },
              },
              { quoted: codeMsg }
            );
          } catch (err) {
            console.error("Upload/send error:", err);
            await sock.sendMessage(sock.user.id, {
              text: "❗ Error creating session: " + err,
            });
          } finally {
            await delay(1000);
            sock.ws.close();
            removeFile("./temp/" + id);
            console.log(`✅ ${sock.user.id} connected & cleaned up`);
          }
        } else if (
          connection === "close" &&
          lastDisconnect?.error?.output?.statusCode !== 401
        ) {
          console.log("Reconnecting...");
          ALI_MD_PAIR();
        }
      });
    } catch (err) {
      console.error("Pairing error:", err);
      removeFile("./temp/" + id);
      if (!res.headersSent) res.send({ code: "❗ Service Unavailable" });
    }
  }

  await ALI_MD_PAIR();
});

module.exports = router;
