// src/services/geminiService.ts
// Consolidated, cleaned, production-ready service used by Chatbot.tsx and VerseTools.tsx
// Exports: getVerseAnalysis, flashGenerate, sendMessageToBot, searchBibleByKeyword, isNewTestament

import { GoogleGenAI, Chat } from "@google/genai";
import type { ChatMode, VerseReference } from "../types";

// GLOBALS
let ai: GoogleGenAI;
let chatInstances = new Map<ChatMode, Chat>();
const verseCache = new Map<string, string>();
let globalCooldownUntil = 0;

// Throttle
let lastCall = 0;
const MIN_GAP = 1500; // ms between Gemini calls

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
  const now = Date.now();
  const wait = lastCall + MIN_GAP - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
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
            "Return RAW plain text. Do NOT add markdown/HTML/LaTeX. Output raw Unicode exactly as-is.",
        },
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
    if (
      raw.includes(`"code":503`) ||
      raw.includes("model is overloaded") ||
      raw.includes("UNAVAILABLE")
    ) {
      throw new Error("The AI model is overloaded. Please switch models.");
    }

    if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
      // shorter cooldown + reset lastCall
      lastCall = Date.now() + 4000;
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
   BOOK GENRE MAP
   -------------------------- */
type Genre =
  | "NT_Epistle"
  | "NT_Gospel"
  | "NT_Apocalyptic"
  | "OT_Law"
  | "OT_History"
  | "OT_Poetry"
  | "OT_Prophet";

const BOOK_GENRES: Record<string, Genre> = {
  "Romans": "NT_Epistle", "1 Corinthians": "NT_Epistle", "2 Corinthians": "NT_Epistle",
  "Galatians": "NT_Epistle", "Ephesians": "NT_Epistle", "Philippians": "NT_Epistle",
  "Colossians": "NT_Epistle", "1 Thessalonians": "NT_Epistle", "2 Thessalonians": "NT_Epistle",
  "1 Timothy": "NT_Epistle", "2 Timothy": "NT_Epistle", "Titus": "NT_Epistle",
  "Philemon": "NT_Epistle", "Hebrews": "NT_Epistle", "James": "NT_Epistle",
  "1 Peter": "NT_Epistle", "2 Peter": "NT_Epistle", "1 John": "NT_Epistle",
  "2 John": "NT_Epistle", "3 John": "NT_Epistle", "Jude": "NT_Epistle",
  "Matthew": "NT_Gospel", "Mark": "NT_Gospel", "Luke": "NT_Gospel", "John": "NT_Gospel",
  "Revelation": "NT_Apocalyptic",
  "Genesis": "OT_Law", "Exodus": "OT_Law", "Leviticus": "OT_Law", "Numbers": "OT_Law", "Deuteronomy": "OT_Law",
  "Joshua": "OT_History", "Judges": "OT_History", "Ruth": "OT_History", "1 Samuel": "OT_History", "2 Samuel": "OT_History",
  "1 Kings": "OT_History", "2 Kings": "OT_History", "1 Chronicles": "OT_History", "2 Chronicles": "OT_History",
  "Ezra": "OT_History", "Nehemiah": "OT_History", "Esther": "OT_History",
  "Job": "OT_Poetry", "Psalms": "OT_Poetry", "Proverbs": "OT_Poetry", "Ecclesiastes": "OT_Poetry", "Song of Solomon": "OT_Poetry",
  "Isaiah": "OT_Prophet", "Jeremiah": "OT_Prophet", "Lamentations": "OT_Prophet", "Ezekiel": "OT_Prophet", "Daniel": "OT_Prophet",
  "Hosea": "OT_Prophet", "Joel": "OT_Prophet", "Amos": "OT_Prophet", "Obadiah": "OT_Prophet", "Jonah": "OT_Prophet",
  "Micah": "OT_Prophet", "Nahum": "OT_Prophet", "Habakkuk": "OT_Prophet", "Zephaniah": "OT_Prophet",
  "Haggai": "OT_Prophet", "Zechariah": "OT_Prophet", "Malachi": "OT_Prophet"
};

function getBookGenre(book: string): Genre {
  return BOOK_GENRES[book] || "NT_Epistle";
}

/* --------------------------
   Transliteration sanitization (Option B)
   -------------------------- */
function sanitizeModelTranslitOptionB(input: string): string {
  if (!input) return "";

  const map: [RegExp, string][] = [
    [/ā/g, "aa"], [/ē/g, "ee"], [/ī/g, "ii"], [/ō/g, "oo"], [/ū/g, "uu"],
    [/ə/g, "a"], [/ḥ/g, "h"], [/ṭ/g, "t"], [/ṣ/g, "s"], [/š|ś/g, "sh"],
    [/ḏ/g, "d"], [/ṯ/g, "t"], [/ḇ/g, "b"], [/ẓ/g, "z"], [/ʿ|ʾ|ʼ|’|`/g, "'"],
    [/á|à|â|ã|ä/g, "a"], [/é|è|ê|ë/g, "e"], [/í|ì|î|ï/g, "i"],
    [/ó|ò|ô|õ|ö/g, "o"], [/ú|ù|û|ü/g, "u"], [/\p{M}/gu, ""]
  ];

  let s = input;
  for (const [rx, repl] of map) s = s.replace(rx, repl);

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

**1. Hebrew Text:**
<raw>

---

**2. English Transliteration:**
<plain ASCII transliteration, only A-Z a-z digits, hyphen, apostrophe>

---

**3. Smooth English Translation:**
<translation>

---

**4. Word-by-Word Analysis:**
<Hebrew> (<ASCII transliteration>) - <English meaning>
<Hebrew> (<ASCII transliteration>) - <English meaning>
<Hebrew> (<ASCII transliteration>) - <English meaning>

Do NOT combine multiple words on the same line.
Do NOT add bullet points or numbering.

Answer in English.
`.trim();
  }

  return `
Generate a STRICTLY STRUCTURED interlinear analysis for ${ref}.

NON-NEGOTIABLE RULES:
- NO markdown except the bold section headers shown below.
- NO commas, NO parentheses except for transliteration, NO brackets.
- EVERY Greek word MUST be followed by EXACT pattern:
  GreekWord (ascii-translit) - EnglishMeaning
- One and only one such triple per line.
- DO NOT join multiple triples on one line.
- DO NOT remove accents from Greek.
- Transliteration MUST be pure ASCII (A-Z a-z hyphens apostrophes).

OUTPUT FORMAT (copy exactly):

**1. Greek Text:**
<raw-greek>

---

**2. English Transliteration:**
<ascii transliteration of whole verse>

---

**3. Smooth English Translation:**
<plain English translation>

---

**4. Word-by-Word Analysis:**
Greek (translit) - meaning
Greek (translit) - meaning
Greek (translit) - meaning
Greek (translit) - meaning

---

Do NOT add any extra sentences or commentary.
Return RAW TEXT ONLY.
`.trim();
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
    // CROSS-REFERENCES
    if (analysisType === "Cross-references") {
      const promptEN = `
Provide a scholarly cross-reference analysis for ${verseRef.book} ${verseRef.chapter}:${verseRef.verse}.

OUTPUT FORMAT (DO NOT CHANGE):

**Summary**
A short 2–3 sentence academic overview explaining the conceptual, theological, or literary networks connected to this verse.

---

**1. Literary Parallels**
A 2–4 sentence scholarly paragraph explaining internal literary parallels.
Then list 3–7 cross-references (ONLY references, no commentary).

---

**2. Thematic Connections**
A short academic paragraph on shared theological or symbolic themes.
Then list 3–7 cross-references.

---

**3. Canonical or Intertextual Links**
A brief paragraph explaining how other biblical authors echo or develop this idea.
Then list 2–6 cross-references.

---

**4. Background or Conceptual Parallels**
A short paragraph describing parallels in law, prophecy, wisdom, or apocalyptic literature.
Then list 2–6 cross-references.

---

STRICT RULES:
- Do NOT quote verses.
- Do NOT add commentary to bullet points.
- Do NOT merge headings.
- Every section must include a paragraph + bullet list.
- Clean, concise, scholarly prose only.
`;
      const rawEN = await safeGenerate("gemini-2.5-flash-lite", promptEN);
      const englishResult = (rawEN || "").trim();
      verseCache.set(baseKeyEN, englishResult);

      if (language === "EN") {
        verseCache.set(cacheKey, englishResult);
        return englishResult;
      }

      const promptTE = `
Translate the following scholarly outline into clear, natural, academic Telugu.

RULES:
- PRESERVE ALL FORMATTING EXACTLY.
- DO NOT translate Biblical book names or references.
- Do NOT translate cross-reference items.
- Output must be clean, readable, and well-spaced.

TEXT:
${englishResult}
`;
      const rawTE = await safeGenerate("gemini-2.5-flash-lite", promptTE);
      const teluguResult = (rawTE || "").trim();
      verseCache.set(cacheKey, teluguResult);
      return teluguResult;
    }

    // HISTORICAL CONTEXT
    if (analysisType === "Historical Context") {
      const genre = getBookGenre(verseRef.book);
      let prompt = `
Provide a full scholarly historical background for ${verseRef.book} ${verseRef.chapter}:${verseRef.verse}.

OUTPUT FORMAT (DO NOT CHANGE):

**Summary**
A short 2–3 sentence academic summary explaining the historical significance of this verse.

---

**1. Historical Setting**
A short paragraph (2–4 sentences).

---

**2. Authorship and Composition**
Short paragraph.

---

**3. Date and Provenance**

---

**4. Literary Context and Purpose**

---

**5. Cultural and Religious Background**

---

**6. Audience Situation**

---

**7. Scholarly Notes and Debates**

---

**8. Additional Genre-Specific Notes**

---

STRICT RULES:
- No verse quoting.
- No devotional tone.
- One short paragraph per section.
`;
      if (genre === "OT_Poetry") prompt += "GENRE GUIDANCE: OT poetry.";
      if (genre === "OT_Law") prompt += "GENRE GUIDANCE: OT law.";
      if (genre === "OT_History") prompt += "GENRE GUIDANCE: OT history.";
      if (genre === "OT_Prophet") prompt += "GENRE GUIDANCE: OT prophets.";
      if (genre === "NT_Gospel") prompt += "GENRE GUIDANCE: NT gospels.";
      if (genre === "NT_Epistle") prompt += "GENRE GUIDANCE: NT epistles.";
      if (genre === "NT_Apocalyptic") prompt += "GENRE GUIDANCE: NT apocalyptic.";

      const res = await safeGenerate("gemini-2.5-flash-lite", prompt);
      const trimmed = (res || "").trim();
      verseCache.set(baseKeyEN, trimmed);
      verseCache.set(cacheKey, trimmed);
      return trimmed;
    }

    // INTERLINEAR - single, consolidated implementation
    if (analysisType === "Interlinear") {
      const prompt = buildInterlinearPrompt(verseRef.book, verseRef.chapter, verseRef.verse);
      let result = await safeGenerate("gemini-2.5-flash-lite", prompt);
      result = (result || "").replace(/\r\n/g, "\n").trim();

      // Start with a working copy
      let finalText = result;

      // NORMALIZE headers — make the headers predictable so regexes match.
      // This tolerates many header variants (plain, bold, missing newline, etc.)
      finalText = finalText
        // Normalize 1. Greek/Hebrew Text header
        .replace(/\**\s*1\.\s*(Hebrew|Greek)\s*Text\s*[:：]?\**/i, "**1. Greek Text:**")
        // Normalize 2. Transliteration header
        .replace(/\**\s*2\.\s*(English\s*)?Transliteration\s*[:：]?\**/i, "**2. English Transliteration:**")
        // Normalize 3. Smooth translation
        .replace(/\**\s*3\.\s*(Smooth\s*)?English\s*Translation\s*[:：]?\**/i, "**3. Smooth English Translation:**")
        // Normalize 4. Word-by-word
        .replace(/\**\s*4\.\s*Word[- ]by[- ]Word Analysis\s*[:：]?\**/i, "**4. Word-by-Word Analysis:**");

      // Extract and sanitize section 2 (transliteration)
      // Accept multiple formats: with or without bold, with or without trailing '---'
      const sec2Rx = /(?:\*\*2\.\s*English Transliteration:\*\*\s*|\b2\.\s*English Transliteration\s*[:：]?\s*)([\s\S]*?)(?=\n\s*(?:\*\*3\.|\b3\.|---))/i;
      const sec2m = finalText.match(sec2Rx);
      if (sec2m && sec2m[1]) {
        const cleaned = sanitizeModelTranslitOptionB(sec2m[1]);
        finalText = finalText.replace(sec2m[1], "\n" + cleaned.trim() + "\n");
      }

      // Clean parenthetical translits where present (e.g., (phobēthōmen) -> (phobeethoomen))
      finalText = finalText.replace(/\(([^\)\n]+)\)/g, (_match, inner) => {
        // sanitize everything found inside parentheses to ascii translit where appropriate
        const cleaned = sanitizeModelTranslitOptionB(inner);
        return `(${cleaned})`;
      });

      // Now enforce strict Word-by-Word splitting with full Greek + apostrophe support.
{
  const wbaSectionRx =
    /(?:\*\*4\.\s*Word-by-Word Analysis:\*\*\s*|\b4\.\s*Word-by-Word Analysis\s*[:：]?\s*)([\s\S]*)$/i;
  const wbaSectionMatch = finalText.match(wbaSectionRx);

  if (wbaSectionMatch) {
    const rawBlock = wbaSectionMatch[1].trim();

    // Extract ALL Greek word entries using a global match
    // Pattern: Greek word (translit) - meaning
    const entryRx =
      /([\p{Script=Greek}\u0370-\u03FF\u1F00-\u1FFF][\p{Script=Greek}\u0370-\u03FF\u1F00-\u1FFF'']*)\s*\(([^()]+)\)\s*-\s*([^.]+?)(?=\s+[\p{Script=Greek}\u0370-\u03FF\u1F00-\u1FFF][\p{Script=Greek}\u0370-\u03FF\u1F00-\u1FFF'']*\s*\(|$)/gu;

    const entries: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = entryRx.exec(rawBlock)) !== null) {
      const greek = match[1].trim();
      const translit = sanitizeModelTranslitOptionB(match[2]);
      const gloss = match[3].trim().replace(/[.,;]+$/, "").replace(/\s+/g, " ");
      entries.push(`${greek} (${translit}) - ${gloss}`);
    }

    let rebuilt = "";
    
    if (entries.length > 0) {
      rebuilt = entries.join("\n");
    } else {
      // Fallback: split on any occurrence of Greek character followed by (
      const simpleRx = /([\p{Script=Greek}\u0370-\u03FF\u1F00-\u1FFF]+[''ʼ']?)\s*\([^)]+\)\s*-\s*[^(]+/gu;
      const parts = rawBlock.match(simpleRx);
      
      if (parts && parts.length > 0) {
        rebuilt = parts.map(p => {
          const cleaned = p.trim().replace(/[.,;]+$/, "");
          return cleaned;
        }).join("\n");
      } else {
        // Ultimate fallback: force split before every Greek word
        rebuilt = rawBlock
          .replace(/([\p{Script=Greek}\u0370-\u03FF\u1F00-\u1FFF]+)/gu, "\n$1")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .join("\n");
      }
    }

    finalText = finalText.replace(
      wbaSectionRx,
      `**4. Word-by-Word Analysis:**\n${rebuilt}`
    );
  }
}


      verseCache.set(baseKeyEN, finalText);
      verseCache.set(cacheKey, finalText);
      return finalText;
    }

    return "";
  } catch (err: any) {
    throw new Error(err?.message || "Failed to load verse analysis.");
  }
};

/* --------------------------
   flashGenerate
--------------------------- */
export const flashGenerate = async (prompt: string) => {
  return safeGenerate("gemini-2.5-flash-lite", prompt);
};

/* --------------------------
   Chat wrapper
--------------------------- */
function getChat(mode: ChatMode): Chat {
  if (!chatInstances.has(mode)) {
    const aiInstance = getAiInstance();
    const newChat = aiInstance.chats.create({
      model: mode,
      config: {
        systemInstruction: "You are an expert Bible scholar. Be precise, deep, and context-rich.",
      },
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
    const langInstr = language === "TE" ? "సమాధానం తెలుగులో ఇవ్వండి." : "Answer in English.";

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
--------------------------- */
export const searchBibleByKeyword = async (keyword: string): Promise<string> => {
  const prompt = `You are a Bible search engine. Keyword: "${keyword}". Return ONLY valid Bible references.`;

  try {
    const raw = await safeGenerate("gemini-2.5-flash-lite", prompt);
    return raw.replace(/[\n\[\]]/g, "").replace(/ +/g, " ").trim();
  } catch {
    return "";
  }
};
