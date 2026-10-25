import axios from "axios";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, lang = "en-US" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

    if (!SARVAM_API_KEY) {
      return res.status(500).json({
        error: "SARVAM_API_KEY missing",
      });
    }

    // Improve pauses
    const formattedText = text
      .replace(/\./g, ". ")
      .replace(/,/g, ", ")
      .replace(/;/g, "; ")
      .replace(/:/g, ": ");

    const response = await axios({
      method: "POST",
      url: "https://api.sarvam.ai/text-to-speech",
      headers: {
        Authorization: `Bearer ${SARVAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      data: {
        text: formattedText,
        target_language_code:
          lang === "te-IN" ? "te-IN" : "en-IN",
        speaker: "anushka",
      },
      responseType: "arraybuffer",
      timeout: 15000,
      validateStatus: () => true,
    });

    const contentType = String(
      response.headers["content-type"] || ""
    );

    if (response.status !== 200) {
      console.error(response.data.toString());
      return res.status(500).json({
        error: "Sarvam TTS failed",
      });
    }

    // JSON response (base64 audio)
    if (contentType.includes("application/json")) {
      let parsed;

      try {
        parsed = JSON.parse(response.data.toString());
      } catch {
        return res.status(500).json({
          error: "Invalid JSON",
        });
      }

      const findBase64 = (obj: any): string | null => {
        if (!obj) return null;

        if (
          typeof obj === "string" &&
          obj.length > 1000
        ) {
          return obj;
        }

        if (Array.isArray(obj)) {
          for (const item of obj) {
            const x = findBase64(item);
            if (x) return x;
          }
        }

        if (typeof obj === "object") {
          for (const key in obj) {
            const x = findBase64(obj[key]);
            if (x) return x;
          }
        }

        return null;
      };

      const base64 = findBase64(parsed);

      if (!base64) {
        return res.status(500).json({
          error: "No audio returned",
        });
      }

      const audioBuffer = Buffer.from(
        base64,
        "base64"
      );

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");

      return res.send(audioBuffer);
    }

    // Raw audio response
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    return res.send(response.data);
  } catch (err: any) {
    console.error(err);

    return res.status(500).json({
      error: "TTS failed",
      details: err.message,
    });
  }
}