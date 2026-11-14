import axios from "axios";

// Allow the Android app (UI served from https://localhost in a WebView) to call this API.
const APP_ORIGINS = new Set(["https://localhost", "http://localhost", "capacitor://localhost"]);
function handleCors(req, res) {
  const origin = req.headers?.origin;
  if (origin && APP_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { text, lang } = req.body;

  if (!text) {
    return res.status(400).send("Missing text");
  }

  const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

  if (!SARVAM_API_KEY) {
    console.error("❌ Missing SARVAM_API_KEY");
    return res.status(500).send("Server misconfigured");
  }



  try {
    // 🔥 TEXT FORMATTING (KEEPED FROM YOUR VERSION)
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
        speaker: "anushka",
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



    // ❌ Request failed
    if (response.status !== 200) {
      console.error("❌ Sarvam error:");
      console.error(response.data.toString());
      return res.status(500).send("TTS failed");
    }

    // ✅ CASE 1: JSON → base64 audio (KEEPED EXACT LOGIC)
    if (contentType.includes("application/json")) {
      let parsed;

      try {
        parsed = JSON.parse(response.data.toString());
      } catch (e) {
        console.error("❌ JSON parse failed");
        return res.status(500).send("Invalid JSON response");
      }

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


      const audioBuffer = Buffer.from(base64, "base64");

      res.setHeader("Content-Type", "audio/mpeg");
      return res.send(audioBuffer);
    }

    // ✅ CASE 2: Raw audio


    res.setHeader("Content-Type", "audio/mpeg");
    return res.send(response.data);

  } catch (err) {
    console.error("🔥 HARD ERROR:", err.message);
    return res.status(500).send("TTS failed");
  }
}