// /api/llama-chat.ts
import Groq from "groq-sdk";

type ChatRole = "user" | "assistant" | "system";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type CacheEntry = {
  text: string;
  sources: any[];
  timestamp: number;
};

// ---------------------------
// Persistent vars
// ---------------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MIN_GAP_MS = 250;

let lastCall = 0;
let globalCooldownUntil = 0; // cooldown after 429
const GLOBAL_COOLDOWN_MS = 60 * 1000;

let activeRequests = 0;
const MAX_CONCURRENT = 3;

// ---------------------------
// Helpers
// ---------------------------

function normalizeHistory(history: any[] = []): ChatMessage[] {
  return history
    .map((h) => {
      if (h?.role && h?.content) {
        return { role: h.role as ChatRole, content: String(h.content) };
      }

      const role: ChatRole = h?.sender === "user" ? "user" : "assistant";
      const content = typeof h?.text === "string" ? h.text : "";

      if (!content.trim()) return null;

      return { role, content };
    })
    .filter(Boolean)
    .slice(-6); // last 6 messages only
}



function buildCacheKey(
  message: string,
  history: any[],
  lang: string
): string {
  return JSON.stringify({
    lang,
    message: message.trim(),
    history: normalizeHistory(history),
  });
}

// ---------------------------
// Handler
// ---------------------------

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { message, history = [], lang = "EN" } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing 'message' string" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY missing" });
  }

  const now = Date.now();

  // cooldown
  if (now < globalCooldownUntil) {
    const retryAfter = Math.ceil((globalCooldownUntil - now) / 1000);
    return res.status(429).json({
      error: "Cooling down due to rate limit",
      retryAfterSeconds: retryAfter,
    });
  }

  const groqHistory = normalizeHistory(history);

  const messages: ChatMessage[] = [
    ...groqHistory,
    { role: "user", content: `${message}\n\nRespond ONLY in clean markdown.`,  },
  ];

  // cache
  const cacheKey = buildCacheKey(message, history, lang);
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.json({
      text: cached.text,
      cached: true,
      sources: cached.sources,
    });
  }

  // concurrency guard
  if (activeRequests >= MAX_CONCURRENT) {
    return res.status(429).json({
      error: "Too many requests in parallel",
    });
  }

  activeRequests++;

  // pacing
  const diff = now - lastCall;
  if (diff < MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_GAP_MS - diff));
  }
  lastCall = Date.now();

  // call Groq
  let completion: any;
  try {
    completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.2,
    });
  } catch (err: any) {
    activeRequests--;

    const msg =
      err?.error?.error?.message ||
      err?.error?.message ||
      err?.message ||
      String(err);

    if (
      err?.status === 429 ||
      msg.toLowerCase().includes("rate") ||
      msg.toLowerCase().includes("quota")
    ) {
      globalCooldownUntil = Date.now() + GLOBAL_COOLDOWN_MS;
    }

    return res.status(500).json({ error: "LLaMA error", details: msg });
  }

  activeRequests--;

  const text = completion?.choices?.[0]?.message?.content || "";

  const entry: CacheEntry = {
    text,
    sources: [],
    timestamp: Date.now(),
  };

  cache.set(cacheKey, entry);

  return res.json({
    text,
    sources: [],
  });
}
