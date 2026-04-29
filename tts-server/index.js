const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// 🔑 MUST use env variable (do NOT hardcode)
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

if (!SARVAM_API_KEY) {
  console.error("❌ Missing SARVAM_API_KEY in environment variables");
  process.exit(1);
}

app.post("/api/tts", async (req, res) => {
  const { text, lang } = req.body;

  if (!text) {
    return res.status(400).send("Missing text");
  }

  console.log("🔊 TTS request:", text.slice(0, 50));

  try {
    const formattedText = text
    .replace(/\./g, ". ")
    .replace(/,/g, ", ")
    .replace(/;/g, "; ")
    .replace(/:/g, ": ");
  
  const response = await axios({
    method: "POST",
    url: "https://api.sarvam.ai/text-to-speech",
    data: {
      text: formattedText,
      target_language_code: lang === "TE" ? "te-IN" : "en-IN",
      speaker: "arjun", // 🔥 male narration voice
    },
    headers: {
      Authorization: `Bearer ${SARVAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    responseType: "arraybuffer",
    timeout: 15000,
    validateStatus: () => true,
  });

    const contentType = response.headers["content-type"] || "";
    console.log("CONTENT TYPE:", contentType);  
    console.log("STATUS:", response.status);
    console.log("TYPE:", contentType);
    console.log("RESPONSE SIZE:", response.data.length);

    // ❌ Request failed
    if (response.status !== 200) {
      console.error("❌ Sarvam error:");
      console.error(response.data.toString());
      return res.status(500).send("TTS failed");
    }

    // ✅ CASE 1: JSON → base64 audio
    if (contentType.includes("application/json")) {
        let parsed;
      
        try {
          parsed = JSON.parse(response.data.toString());
        } catch (e) {
          console.error("❌ JSON parse failed");
          return res.status(500).send("Invalid JSON response");
        }
      
        // 🔥 recursive search for base64 string
        const findBase64 = (obj) => {
          if (!obj) return null;
      
          if (typeof obj === "string" && obj.length > 1000) {
            return obj;
          }
      
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const found = findBase64(item);
              if (found) return found;
            }
          }
      
          if (typeof obj === "object") {
            for (const key in obj) {
              const found = findBase64(obj[key]);
              if (found) return found;
            }
          }
      
          return null;
        };
      
        const base64 = findBase64(parsed);
      
        if (!base64) {
          console.error("❌ Could not find base64 audio:");
          console.error(parsed);
          return res.status(500).send("Invalid TTS response");
        }
      
        console.log("✅ Base64 audio extracted (robust)");
      
        const audioBuffer = Buffer.from(base64, "base64");
      
        res.set("Content-Type", "audio/mpeg");
        return res.send(audioBuffer);
      }

    // ✅ CASE 2: Raw audio
    console.log("✅ Direct audio stream");

    res.set("Content-Type", "audio/mpeg");
    res.send(response.data);

  } catch (err) {
    console.error("🔥 HARD ERROR:", err.message);
    res.status(500).send("TTS failed");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 TTS server running at http://localhost:${PORT}`);
});