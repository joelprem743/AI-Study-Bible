// VerseTools + Chatbot helpers.
// All AI calls now go through backend APIs; no keys on the frontend.

import { VerseReference } from "..";

/* ============================================================
  TESTAMENT HELPER (used by VerseTools.tsx for Interlinear)
============================================================ */

const NT_BOOKS = new Set([
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
]);

export function isNewTestament(book: string) {
  return NT_BOOKS.has(book);
}

/* ============================================================
  FRONTEND CACHE FOR VERSE TOOLS
============================================================ */
const CACHE_TTL_MS = 10 * 60 * 1000;


const verseCache = new Map<
  string,
  { text: string; ts: number }
>();


/* ============================================================
  MAIN: getVerseAnalysis (VerseTools → /api/verse-tools)
============================================================ */

export const getVerseAnalysis = async (
  verse: VerseReference,
  section: "Cross-references" | "Historical Context" | "Interlinear",
  language: "EN" | "TE" = "EN"
) => {
  const baseKey = `${verse.book}-${verse.chapter}-${verse.verse}-${section}`;
  const cacheKey = `${baseKey}-${language}`;

  const cached = verseCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.text;
  }
  

  const type =
    section === "Cross-references"
      ? "cross"
      : section === "Historical Context"
      ? "historical"
      : "interlinear";

  const res = await fetch("/api/verse-tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      book: verse.book,
      chapter: verse.chapter,
      verse: verse.verse,
      lang: language,
    }),
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // ignore parse error; we'll handle via status
  }

  if (!res.ok) {
    const msg =
      (data && data.error) ||
      `VerseTools AI backend error: ${res.status} ${res.statusText} ${raw || ""}`.trim();
    throw new Error(msg);
  }

  const text = (data?.text ?? "").toString().trim();
  verseCache.set(cacheKey, {
    text,
    ts: Date.now(),
  });
  
  return text;
};



/* ============================================================
  CHATBOT SUPPORT (uses /api/llama-chat on backend)
============================================================ */

export const sendMessageToLlama = async (
  message: string,
  history: any[],
  lang: "EN" | "TE" = "EN",
  depth: "SHORT" | "MEDIUM" | "DEEP" = "MEDIUM"
) => {

  const res = await fetch("/api/llama-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      lang,
      depth,
    }),    
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // non-JSON; fall through
  }

  if (!res.ok) {
    const errMsg =
      (data && data.error) ||
      `LLaMA API error: ${res.status} ${res.statusText} ${raw || ""}`.trim();
      const err = new Error(errMsg);
      (err as any).source = "LLAMA_CHAT";
      throw err;
      
  }

  return {
    text: (data?.text ?? "")
      .replace(/[–—]/g, "-")
      .trim(),
    sources: data?.sources ?? [],
  };
  
};

/* ============================================================
  SIMPLE FLASH GENERATOR (generic prompt → /api/gemini-generic)
============================================================ */

export const flashGenerate = async (prompt: string) => {
  const res = await fetch("/api/gemini-generic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg =
      (data && data.error) ||
      `Gemini generic API error: ${res.status} ${res.statusText} ${raw || ""}`.trim();
    throw new Error(msg);
  }

  return (data?.text ?? "")
  .toString()
  .replace(/[–—]/g, "-")
  .trim();

};

/* ============================================================
  KEYWORD SEARCH (also via /api/gemini-generic)
============================================================ */

export const searchBibleByKeyword = async (keyword: string): Promise<string> => {
  try {
    const prompt = `
Return ONLY Bible references related to "${keyword}".

Rules:
• Only references like: John 3:16; Romans 8:1–4
• No commentary.
• No extra text.
`.trim();

    const res = await fetch("/api/gemini-generic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        cacheKey: `kw-${keyword.toLowerCase()}`,
      }),
    });

    const raw = await res.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      // ignore
    }

    if (!res.ok) {
      const msg =
        (data && data.error) ||
        `Gemini keyword API error: ${res.status} ${res.statusText} ${raw || ""}`.trim();
      throw new Error(msg);
    }

    const text = (data?.text ?? "").toString();
    return text.replace(/\s+/g, " ").trim();
  } catch {
    // If AI is disabled or quota is gone, just return empty.
    return "";
  }
};
