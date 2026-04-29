import textToSpeech from "@google-cloud/text-to-speech";

const client = new textToSpeech.TextToSpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string),
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, lang = "en-US" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const voiceName =
      lang === "te-IN"
        ? "te-IN-Standard-A"
        : "en-US-Neural2-F";

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: lang,
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
      },
    });

    if (!response.audioContent) {
      return res.status(500).json({ error: "No audio returned" });
    }

    const audioBuffer = Buffer.from(
      response.audioContent as string,
      "base64"
    );

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    return res.send(audioBuffer);
  } catch (err: any) {
    console.error("🔥 TTS ERROR:", err);

    return res.status(500).json({
      error: "TTS failed",
      details: err.message,
    });
  }
}