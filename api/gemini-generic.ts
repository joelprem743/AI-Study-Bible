import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getApiKey() {
  return process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
}

function getAi() {
  if (!ai) {
    const key = getApiKey();
    if (!key) {
      throw new Error("Missing Gemini API key (VITE_API_KEY or GEMINI_API_KEY).");
    }
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

async function safeGenerate(prompt: string, model = "gemini-2.5-flash-lite") {
  const aiInstance = getAi();
  const response = await aiInstance.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 0.25 },
  });
  return (response as any)?.text?.trim?.() ?? "";
}

// tiny cache so we don't pay twice for same prompt in one session
const cache = new Map<string, string>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { prompt, cacheKey, model } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt." });
    }

    const key =
      typeof cacheKey === "string" && cacheKey.length > 0
        ? cacheKey
        : `generic:${(model || "gemini-2.5-flash-lite")}:${prompt.slice(0, 200)}`;

    const cached = cache.get(key);
    if (cached) return res.status(200).json({ text: cached, cached: true });

    const text = await safeGenerate(prompt, model || "gemini-2.5-flash-lite");
    cache.set(key, text);

    return res.status(200).json({ text });
  } catch (err: any) {
    console.error("Gemini generic API error:", err);
    return res.status(500).json({ error: err?.message || "Internal Error" });
  }
}
