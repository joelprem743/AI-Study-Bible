// /api/llama-chat.ts
import Groq from "groq-sdk";

// ---------------------------
// Persistent vars (per lambda instance)
// ---------------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const cache = new Map<string, { text: string; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MIN_GAP_MS = 250;

let lastCall = 0;
let globalCooldownUntil = 0;        // cooldown after 429
const GLOBAL_COOLDOWN_MS = 60 * 1000;

let activeRequests = 0;
const MAX_CONCURRENT = 3;

// ---------------------------
// Helpers
// ---------------------------

function normalizeHistory(history: any[]) {
  return (history || [])
    .map((h) => {
      if (h?.role && h?.content) return { role: h.role, content: String(h.content) };

      const role = h.sender === "user" ? "user" : "assistant";
      const content = typeof h.text === "string" ? h.text : "";
      if (!content.trim()) return null;
      return { role, content };
    })
    .filter(Boolean)
    .slice(-6); // only last 6 messages matter
}

function buildCacheKey(message: string, history: any[], lang: string) {
  return JSON.stringify({
    lang,
    message: message.trim(),
    history: normalizeHistory(history),
  });
}

// ---------------------------
// API Route Handler
// ---------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { message, history = [], lang = "EN" } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing 'message' string" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY missing on Vercel" });
  }

  const now = Date.now();

  // ---------------------------
  // Global cooldown
  // ---------------------------
  if (now < globalCooldownUntil) {
    return res.status(429).json({
      error: "Cooling down due to rate limit",
      retryAfterSeconds: Math.ceil((globalCooldownUntil - now) / 1000),
    });
  }

  // ---------------------------
  // Build request
  // ---------------------------
  const groqHistory = normalizeHistory(history);

  const messages = [
    ...groqHistory,
    { role: "user", content: message },
  ];

  // ---------------------------
  // CACHE CHECK
  // ---------------------------
  const cacheKey = buildCacheKey(message, history, lang);
  const cached = cache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.status(200).json({
      text: cached.text,
      cached: true,
      sources: [],
    });
  }

  // ---------------------------
  // Concurrency limit
  // ---------------------------
  if (activeRequests >= MAX_CONCURRENT) {
    return res.status(429).json({
      error: "Too many requests in parallel. Try again soon.",
    });
  }

  activeRequests++;

  // ---------------------------
  // Pacing between calls
  // ---------------------------
  const diff = now - lastCall;
  if (diff < MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_GAP_MS - diff));
  }
  lastCall = Date.now();

  // ---------------------------
  // Call Groq LLaMA
  // ---------------------------
  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.2,
    });
  } catch (err: any) {
    activeRequests--;

    const errorMsg =
      err?.error?.error?.message ||
      err?.error?.message ||
      err?.message ||
      String(err);

    // Enter global cooldown on 429
    if (
      err.status === 429 ||
      errorMsg.includes("rate") ||
      errorMsg.includes("quota") ||
      errorMsg.includes("exceeded")
    ) {
      globalCooldownUntil = Date.now() + GLOBAL_COOLDOWN_MS;
    }

    return res.status(500).json({
      error: "LLaMA request failed",
      details: errorMsg,
    });
  }

  activeRequests--;

  const text = completion?.choices?.[0]?.message?.content || "";

  // SAVE CACHE
  cache.set(cacheKey, { text, timestamp: Date.now() });

  return res.status(200).json({
    text,
    sources: [],
  });
}
