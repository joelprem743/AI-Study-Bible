// src/services/geminiService.ts
// Fully merged, production-ready service used by Chatbot.tsx and VerseTools.tsx
// Exports: getVerseAnalysis, flashGenerate, sendMessageToBot, searchBibleByKeyword, isNewTestament

import { GoogleGenAI, Chat } from "@google/genai";
import type { ChatMode, VerseReference } from "../types";

// GLOBALS
let ai: GoogleGenAI;
let chatInstances = new Map<ChatMode, Chat>();
const verseCache = new Map<string, string>();
let globalCooldownUntil = 0;

// *** ADDED: global request throttling ***
let lastCall = 0;
const MIN_GAP = 1500; // 1.5s between Gemini calls

class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyError";
  }
}

function getAiInstance() {
  if (!ai) {
    const apiKey = (import.meta as any).env?.VITE_API_KEY;
    if (!apiKey) throw new ApiKeyError("API key missing.");
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

/**
 * safeGenerate - wrapper for text-generation calls with basic throttling and error mapping.
 */
async function safeGenerate(model: string, prompt: string) {

  // *** ADDED: Pre-call throttle gap ***
  const now = Date.now();
  const wait = lastCall + MIN_GAP - now;
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  lastCall = Date.now();

  if (Date.now() < globalCooldownUntil) {
    const secs = Math.ceil((globalCooldownUntil - Date.now()) / 1000);
    throw new Error(`AI cooling down. Try again in ${secs}s.`);
  }

  try {
    const aiInstance = getAiInstance();

    // modern genai SDK surface
    if ((aiInstance as any).models?.generateContent) {
      const response = await (aiInstance as any).models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.2,
          systemInstruction:
            "Return RAW plain text. Do NOT add markdown/HTML/LaTeX. Output raw Unicode exactly as-is."
        }
      });
      return (response?.text || "").trim();
    }

    // fallback older interface
    if ((aiInstance as any).generate) {
      const response = await (aiInstance as any).generate({ model, prompt });
      return (response?.text || "").trim();
    }

    throw new Error("Unsupported AI client interface.");
  } catch (err: any) {
    const raw = err?.message || "";

    // map common service errors to actionable messages / cooldown
    if (raw.includes(`"code":503`) || raw.includes("model is overloaded") || raw.includes("UNAVAILABLE")) {
      throw new Error("The AI model is overloaded. Please switch models.");
    }

    if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
      // *** MODIFIED: shorter cooldown + reset lastCall ***
      lastCall = Date.now() + 4000;      // 4s retry delay
      globalCooldownUntil = Date.now() + 4000;
      throw new Error("AI is busy. Please try again in a few seconds.");
    }

    throw err;
  }
}

/* --------------------------
   New Testament detection
   -------------------------- */
const NT_BOOKS = new Set([
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians",
  "Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
  "1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter",
  "1 John","2 John","3 John","Jude","Revelation"
]);

export function isNewTestament(book: string) {
  return NT_BOOKS.has(book);
}

/* --------------------------
   Transliteration sanitization (Option B)
   -------------------------- */
function sanitizeModelTranslitOptionB(input: string): string {
  if (!input) return "";

  const map: [RegExp, string][] = [
    [/ā/g, "aa"],
    [/ē/g, "ee"],
    [/ī/g, "ii"],
    [/ō/g, "oo"],
    [/ū/g, "uu"],
    [/ə/g, "a"],
    [/ḥ/g, "h"],
    [/ṭ/g, "t"],
    [/ṣ/g, "s"],
    [/š|ś/g, "sh"],
    [/ḏ/g, "d"],
    [/ṯ/g, "t"],
    [/ḇ/g, "b"],
    [/ẓ/g, "z"],
    [/ʿ|ʾ|ʼ|’|`/g, "'"],
    [/á|à|â|ã|ä/g, "a"],
    [/é|è|ê|ë/g, "e"],
    [/í|ì|î|ï/g, "i"],
    [/ó|ò|ô|õ|ö/g, "o"],
    [/ú|ù|û|ü/g, "u"],
    [/\p{M}/gu, ""], // remove combining diacritics (Unicode)
  ];

  let s = input;
  for (const [rx, repl] of map) s = s.replace(rx, repl);

  // allow only ASCII letters, digits, spaces, apostrophes and hyphens
  s = s.replace(/[^A-Za-z0-9'\-\s]/g, "");
  s = s.replace(/'+/g, "'");
  s = s.replace(/([A-Za-z0-9])'([A-Za-z0-9])/g, "$1-$2");
  s = s.replace(/-+/g, "-");

  return s.trim();
}

/* --------------------------
   Interlinear prompt builder
   -------------------------- */
function buildInterlinearPrompt(book: string, chapter: number, verse: number) {
  const ref = `${book} ${chapter}:${verse}`;

  if (!isNewTestament(book)) {
    return `
Return an interlinear analysis for ${ref}.

STRICT RULES:
- Output RAW Hebrew exactly (do not modify Hebrew).
- No markdown, no HTML.
- Preserve line breaks.
- Section 2 (English Transliteration) MUST use only plain ASCII letters, hyphen and apostrophe if needed.
  * NO diacritics, NO macrons, NO IPA symbols.
- Word-by-word transliteration should follow the same ASCII rule.

FORMAT (must match exactly):

1. Hebrew Text:
<raw>

2. English Transliteration:
<plain ASCII transliteration, only A-Z a-z digits, hyphen, apostrophe>

3. Smooth English Translation:
<translation>

4. Word-by-Word Analysis:
<Hebrew> (<ASCII transliteration>) - <English meaning>

Answer in English.`.trim();
  }

  return `
Return an interlinear analysis for ${ref}.

STRICT RULES:
- Output RAW Greek exactly (do not modify Greek).
- No markdown, no HTML.
- Preserve line breaks.
- Section 2 (English Transliteration) MUST use only plain ASCII letters, hyphen and apostrophe if needed.
  * NO diacritics, NO macrons, NO IPA symbols.
- Word-by-word transliteration should follow the same ASCII rule.

FORMAT (must match exactly):

1. Greek Text:
<raw>

2. English Transliteration:
<plain ASCII transliteration, only A-Z a-z digits, hyphen, apostrophe>

3. Smooth English Translation:
<translation>

4. Word-by-Word Analysis:
<Greek> (<ASCII transliteration>) - <English meaning>

Answer in English.`.trim();
}

/* --------------------------
   getVerseAnalysis
   -------------------------- */
export const getVerseAnalysis = async (
  verseRef: VerseReference,
  analysisType: "Cross-references" | "Historical Context" | "Interlinear",
  language: "EN" | "TE" = "EN"
) => {
  const cacheKey = `${verseRef.book}-${verseRef.chapter}-${verseRef.verse}-${analysisType}-${language}`;
  if (verseCache.has(cacheKey)) return verseCache.get(cacheKey)!;

  const baseKeyEN = `${verseRef.book}-${verseRef.chapter}-${verseRef.verse}-${analysisType}-EN`;

  try {
    let result = "";

    if (analysisType === "Cross-references") {
      const prompt = `Provide key cross-references for ${verseRef.book} ${verseRef.chapter}:${verseRef.verse}. Group by meaningful theme. Do NOT add extended commentary. Answer in English.`;
      result = await safeGenerate("gemini-2.5-flash-lite", prompt);
      result = (result || "").trim();
      verseCache.set(baseKeyEN, result);
      verseCache.set(cacheKey, result);
      return result;
    }

    if (analysisType === "Historical Context") {
      const prompt = `Explain the historical and cultural background of ${verseRef.book} ${verseRef.chapter}:${verseRef.verse}. Be factual and concise. Answer in English.`;
      result = await safeGenerate("gemini-2.5-flash-lite", prompt);
      result = (result || "").trim();
      verseCache.set(baseKeyEN, result);
      verseCache.set(cacheKey, result);
      return result;
    }

    if (analysisType === "Interlinear") {
      const prompt = buildInterlinearPrompt(verseRef.book, verseRef.chapter, verseRef.verse);
      result = await safeGenerate("gemini-2.5-flash-lite", prompt);
      result = result.replace(/\r\n/g, "\n").trim();

      const sec2Rx = /(2\.\s*English Transliteration\s*[:\n]*)([\s\S]*?)(?=\n\s*3\.)/i;
      let finalText = result;
      const m = result.match(sec2Rx);
      if (m && m[2]) {
        const sec2Clean = sanitizeModelTranslitOptionB(m[2]);
        finalText = finalText.replace(m[2], sec2Clean);
      }

      finalText = finalText.replace(/\(([^\)\n]+)\)/g, (m2, p1) => {
        if (/[A-Za-z\u00C0-\u024Fʼʾʿəāēīōūḥṭṣšḏṯḇẓ]/.test(p1)) {
          const clean = sanitizeModelTranslitOptionB(p1);
          return `(${clean})`;
        }
        return m2;
      });

      finalText = finalText.trim();

      verseCache.set(baseKeyEN, finalText);
      verseCache.set(cacheKey, finalText);
      return finalText;
    }
  } catch (err: any) {
    throw new Error(err?.message || "Failed to load verse analysis.");
  }

  return "";
};

/* --------------------------
   flashGenerate
   -------------------------- */
export const flashGenerate = async (prompt: string) => {
  return safeGenerate("gemini-2.5-flash-lite", prompt);
};

/* --------------------------
   Chat wrapper
   -------------------------- */
function getChat(mode: ChatMode): Chat {
  if (!chatInstances.has(mode)) {
    const aiInstance = getAiInstance();
    const newChat = aiInstance.chats.create({
      model: mode,
      config: { 
        systemInstruction: "You are an expert Bible scholar. Be precise, deep, and context-rich."
      }
    });
    chatInstances.set(mode, newChat);
  }
  return chatInstances.get(mode)!;
}

export const sendMessageToBot = async (
  message: string,
  history: any[] = [],
  mode: ChatMode,
  language: "EN" | "TE" = "EN"
) => {
  try {
    const langInstr =
      language === "TE"
        ? "సమాధానం తెలుగులో ఇవ్వండి."
        : "Answer in English.";


    if (mode === "gemini-2.5-flash" || mode === "gemini-2.5-flash-lite") {
      const fullPrompt = `${message}\n\n${langInstr}`;
      const text = await safeGenerate("gemini-2.5-flash-lite", fullPrompt);
      return { text, sources: [] };
    }

    const chat = getChat(mode);
    const result = await chat.sendMessage({ message: `${message}\n\n${langInstr}` });
    return { text: result.text, sources: [] };
  } catch (err: any) {
    const raw = err?.message || "";
    if (raw.includes("model is overloaded") || raw.includes(`"code":503`) || raw.includes("UNAVAILABLE")) {
      return { text: "The AI model is overloaded. Try switching models.", sources: [] };
    }
    return { text: raw || "AI error", sources: [] };
  }
};

/* --------------------------
   searchBibleByKeyword
   -------------------------- */
export const searchBibleByKeyword = async (keyword: string): Promise<string> => {
  const prompt = `You are a Bible search engine. Keyword: "${keyword}". Return ONLY valid Bible references.`;

  try {
    const raw = await safeGenerate("gemini-2.5-flash-lite", prompt);
    return raw.replace(/[\n\[\]]/g, "").replace(/ +/g, " ").trim();
  } catch {
    return "";
  }
};
