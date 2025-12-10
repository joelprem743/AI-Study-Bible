// server/routes/llama-chat.js
import express from "express";
import Groq from "groq-sdk";

const router = express.Router();

/**
 * Single Groq client for the whole process
 */
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error("❌ GROQ_API_KEY is missing in environment");
}
const groq = new Groq({ apiKey });

/**
 * In-memory cache + rate limiting / throttling
 */
const cache = new Map(); // key -> { text, sources, timestamp }
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

let lastCall = 0;
const MIN_GAP_MS = 250; // spacing between requests

let globalCooldownUntil = 0; // timestamp until which we reject quickly
const GLOBAL_COOLDOWN_MS = 60 * 1000; // 1 minute on hard rate limit

let activeRequests = 0;
const MAX_CONCURRENT = 3;

/**
 * Normalize history coming from the frontend (React messages)
 * to Groq's { role, content } format.
 */
function normalizeHistory(history = []) {
  return history
    .map((h) => {
      // If already in Groq format
      if (h && h.role && h.content) {
        return { role: h.role, content: String(h.content) };
      }

      // Your React Message shape: { id, text, sender: "user" | "bot" }
      const role = h.sender === "user" ? "user" : "assistant";
      const content =
        typeof h.text === "string"
          ? h.text
          : typeof h.text === "number"
          ? String(h.text)
          : "";

      if (!content.trim()) return null;

      return { role, content };
    })
    .filter(Boolean);
}

/**
 * Build a cache key from the effective chat input.
 * Includes lang + last user message + normalized history.
 */
function buildCacheKey({ message, history, lang }) {
  const normalizedHistory = normalizeHistory(history).slice(-6); // last 6 turns max
  return JSON.stringify({
    lang,
    message: message.trim(),
    history: normalizedHistory,
  });
}

router.post("/", async (req, res) => {
  try {
    const { message, history = [], lang = "EN" } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing 'message' in body" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY missing" });
    }

    const now = Date.now();

    // Global cooldown (after heavy rate limit)
    if (now < globalCooldownUntil) {
      const retryAfter = Math.max(
        1,
        Math.ceil((globalCooldownUntil - now) / 1000)
      );
      return res.status(429).json({
        error: "LLaMA cooling down due to previous rate limit.",
        retryAfterSeconds: retryAfter,
      });
    }

    // Normalize history to Groq format
    const groqHistory = normalizeHistory(history);
    const messages = [
      ...groqHistory,
      {
        role: "user",
        content: message,
      },
    ];

    // CACHE: reuse answers for same (lang + message + history)
    const cacheKey = buildCacheKey({ message, history, lang });
    const cached = cache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return res.json({
        text: cached.text,
        sources: cached.sources || [],
        cached: true,
      });
    }

    // Simple pacing between calls
    const diff = now - lastCall;
    if (diff < MIN_GAP_MS) {
      await new Promise((r) => setTimeout(r, MIN_GAP_MS - diff));
    }
    lastCall = Date.now();

    // Concurrency guard
    if (activeRequests >= MAX_CONCURRENT) {
      return res.status(429).json({
        error: "Too many AI requests in parallel. Please try again in a few seconds.",
      });
    }

    activeRequests += 1;

    console.log("➡️ Calling Groq LLaMA for message:", message.slice(0, 80));

    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.2,
        // max_tokens: 1024, // optional: uncomment if you want hard cap
      });
    } catch (err) {
      const rawMsg =
        err?.error?.error?.message ||
        err?.error?.message ||
        err?.message ||
        String(err);
      const lower = rawMsg.toLowerCase();

      // If Groq says rate limit / quota -> enter cooldown
      if (
        err?.status === 429 ||
        lower.includes("rate limit") ||
        lower.includes("quota") ||
        lower.includes("exceeded")
      ) {
        globalCooldownUntil = Date.now() + GLOBAL_COOLDOWN_MS;
      }

      console.error("❌ LLaMA / Groq error:", rawMsg);
      return res
        .status(500)
        .json({ error: "LLaMA request failed", details: rawMsg });
    } finally {
      activeRequests -= 1;
    }

    const text = completion?.choices?.[0]?.message?.content || "";
    const result = { text, sources: [] };

    // Save in cache
    cache.set(cacheKey, {
      ...result,
      timestamp: Date.now(),
    });

    return res.json(result);
  } catch (err) {
    console.error("❌ LLaMA route fatal error:", err);
    return res
      .status(500)
      .json({ error: "LLaMA route crashed", details: String(err) });
  }
});

export default router;
