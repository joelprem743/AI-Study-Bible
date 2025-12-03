// src/services/geminiService.ts
// Gemini service used by VerseTools, Chatbot, and Search.
// Stable, cached, and optimized for EN/TE separately.

import { GoogleGenAI, Chat } from "@google/genai";
import type { ChatMode, VerseReference } from "../types";

/* ============================================================
  GLOBALS & INITIALIZATION
============================================================ */

let ai: GoogleGenAI | null = null;
let chatInstances = new Map<ChatMode, Chat>();

// Cache: unique per verse + section + language
const verseCache = new Map<string, string>();

let globalCooldownUntil = 0;
let lastCall = 0;
const MIN_GAP_MS = 250;

class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyError";
  }
}

function getAiInstance() {
  if (!ai) {
    const apiKey = (import.meta as any).env?.VITE_API_KEY;
    if (!apiKey) throw new ApiKeyError("Missing Gemini API Key.");
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

/* ============================================================
  SAFE GENERATE WRAPPER (RATE-LIMIT + ERROR HANDLING)
============================================================ */

async function safeGenerate(model: string, prompt: string): Promise<string> {
  const now = Date.now();
  const diff = now - lastCall;

  // Simple per-process pacing
  if (diff < MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_GAP_MS - diff));
  }

  lastCall = Date.now();

  if (now < globalCooldownUntil) {
    throw new Error(
      `AI cooling down. Try again in ${Math.ceil(
        (globalCooldownUntil - now) / 1000
      )}s.`
    );
  }

  const aiInstance = getAiInstance();

  // Primary model + minimal fallback set
  const modelsToTry = Array.from(
    new Set([model, "gemini-2.5-flash-lite", "gemini-2.5-flash"])
  );

  for (const m of modelsToTry) {
    let retries = 3;
    let backoff = 300;

    while (retries--) {
      try {
        const response = await aiInstance.models.generateContent({
          model: m,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { temperature: 0.25 },
        });

        const text = (response as any)?.text?.trim?.() ?? "";
        return text;
      } catch (err: any) {
        const msg = err?.message || "";

        // Model overloaded
        if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
          if (retries === 0) break;
          await new Promise((r) => setTimeout(r, backoff));
          backoff *= 2;
          continue;
        }

        // Rate limit
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
          globalCooldownUntil = Date.now() + 3000;
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        // Other errors: bail out after retries
        if (retries === 0) throw new Error(msg || "AI error");
      }
    }
  }

  throw new Error("AI temporarily unavailable. Please try again.");
}

/* ============================================================
  TESTAMENT HELPERS
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
  BOOK GENRES (HISTORICAL CONTEXT)
============================================================ */

const BOOK_GENRES: Record<string, string> = {
  Romans: "NT_Epistle",
  "1 Corinthians": "NT_Epistle",
  "2 Corinthians": "NT_Epistle",
  Galatians: "NT_Epistle",
  Ephesians: "NT_Epistle",
  Philippians: "NT_Epistle",
  Colossians: "NT_Epistle",
  "1 Thessalonians": "NT_Epistle",
  "2 Thessalonians": "NT_Epistle",
  "1 Timothy": "NT_Epistle",
  "2 Timothy": "NT_Epistle",
  Titus: "NT_Epistle",
  Philemon: "NT_Epistle",
  Hebrews: "NT_Epistle",
  James: "NT_Epistle",
  "1 Peter": "NT_Epistle",
  "2 Peter": "NT_Epistle",
  "1 John": "NT_Epistle",
  "2 John": "NT_Epistle",
  "3 John": "NT_Epistle",
  Jude: "NT_Epistle",

  Matthew: "NT_Gospel",
  Mark: "NT_Gospel",
  Luke: "NT_Gospel",
  John: "NT_Gospel",

  Revelation: "NT_Apocalyptic",

  Genesis: "OT_Law",
  Exodus: "OT_Law",
  Leviticus: "OT_Law",
  Numbers: "OT_Law",
  Deuteronomy: "OT_Law",

  Joshua: "OT_History",
  Judges: "OT_History",
  Ruth: "OT_History",
  "1 Samuel": "OT_History",
  "2 Samuel": "OT_History",
  "1 Kings": "OT_History",
  "2 Kings": "OT_History",
  "1 Chronicles": "OT_History",
  "2 Chronicles": "OT_History",
  Ezra: "OT_History",
  Nehemiah: "OT_History",
  Esther: "OT_History",

  Job: "OT_Poetry",
  Psalms: "OT_Poetry",
  Proverbs: "OT_Poetry",
  Ecclesiastes: "OT_Poetry",
  "Song of Solomon": "OT_Poetry",

  Isaiah: "OT_Prophet",
  Jeremiah: "OT_Prophet",
  Lamentations: "OT_Prophet",
  Ezekiel: "OT_Prophet",
  Daniel: "OT_Prophet",
  Hosea: "OT_Prophet",
  Joel: "OT_Prophet",
  Amos: "OT_Prophet",
  Obadiah: "OT_Prophet",
  Jonah: "OT_Prophet",
  Micah: "OT_Prophet",
  Nahum: "OT_Prophet",
  Habakkuk: "OT_Prophet",
  Zephaniah: "OT_Prophet",
  Haggai: "OT_Prophet",
  Zechariah: "OT_Prophet",
  Malachi: "OT_Prophet",
};

function getBookGenre(book: string) {
  return BOOK_GENRES[book] || "General";
}

/* ============================================================
  INTERLINEAR PROMPT BUILDER (EN ONLY)
============================================================ */

function buildInterlinearPrompt(book: string, chapter: number, verse: number) {
  const ref = `${book} ${chapter}:${verse}`;

  if (!isNewTestament(book)) {
    return `
You are generating a Hebrew interlinear analysis for the verse: ${ref}.

STRICT RULES:
1. No introductions.
2. Follow the exact structure shown.
3. Hebrew text MUST remain untouched.
4. Transliteration MUST be ASCII only.

FORMAT:

**1. Hebrew Text:**
<raw MT Hebrew>

---

**2. English Transliteration:**
<ASCII transliteration>

---

**3. Smooth English Translation:**
<one clear sentence>

---

**4. Word-by-Word Analysis:**
HebrewWord (ascii-translit) – english-gloss
HebrewWord (ascii-translit) – english-gloss
HebrewWord (ascii-translit) – english-gloss

END.
`.trim();
  }

  return `
You are generating a Greek interlinear analysis for the verse: ${ref}.

STRICT RULES:
1. No introductions.
2. Keep accents and breathings.
3. ASCII transliteration only.
4. Exact structure only.

FORMAT:

**1. Greek Text:**
<raw Greek text>

---

**2. English Transliteration:**
<ASCII transliteration>

---

**3. Smooth English Translation:**
<one clear sentence>

---

**4. Word-by-Word Analysis:**
GreekWord (ascii-translit) – english-gloss
GreekWord (ascii-translit) – english-gloss
GreekWord (ascii-translit) – english-gloss

END.
`.trim();
}

/* ============================================================
  CROSS-REFERENCES PROMPTS (EN & TE NATIVE)
============================================================ */

function buildCrossRefsPromptEN(v: VerseReference) {
  return `
You are generating CROSS-REFERENCES + SCHOLARLY COMMENTARY for:
${v.book} ${v.chapter}:${v.verse}

FORMAT EXACTLY:

**Cross-References (With Explanations)**
Provide 3–7 bullet points.
Each bullet MUST follow this minimal strict format:

- BookName 1:1 — one short sentence explaining the thematic link.

Rules:
• NO scripture quotations.
• NO invented references.
• NO ANE mythology unless directly connected.

---

**Scholarly Commentary**
Write 2–4 short paragraphs.
Each paragraph 2–4 sentences.
Cover:
• historical setting
• linguistic insight
• theological theme
• literary function

No long blocks. No quotes.

Begin.
`.trim();
}

function buildCrossRefsPromptTE(v: VerseReference) {
  return `
క్రింది వాక్యానికి సంబంధించి క్రాస్ రిఫరెన్సులు మరియు పండితుల వ్యాఖ్యానం తెలుగులో ఇవ్వండి:

${v.book} ${v.chapter}:${v.verse}

FORMAT (మార్క్‌డౌన్ నిర్మాణం తప్పనిసరి):

**సంబంధిత వచనాలు (వివరణలతో)**
3–7 బుల్లెట్ పాయింట్లు రాయండి.
ప్రతి బుల్లెట్ ఈ ఫార్మాట్‌లో ఉండాలి:

- పుస్తకనామం 1:1 — ఈ వచనంతో ఉన్న థీమాటిక్ / ఆలోచనా సంబంధాన్ని తెలుగులో ఒక చిన్న వాక్యంతో వివరించండి.

RULES:
• వచనాలను కోట్ చేయకండి (పరామర్శ మాత్రమే చేయండి).
• బైబిల్‌లో లేని ఊహాత్మక రిఫరెన్సులు వద్దు.
• ఒక్కో బుల్లెట్ ఒకే వాక్యంగా ఉండాలి.

---

**పండితుల వ్యాఖ్యానం**
2–4 చిన్న పేరాలు రాయండి.
ప్రతి పేరా 2–4 వాక్యాలు మాత్రమే.

కవర చేయాల్సిన అంశాలు:
• చారిత్రక నేపథ్యం
• సాంస్కృతిక / సామాజిక పరిస్థితి
• భాషా పరమైన సూచనలు
• థియాలజికల్ థీమ్
• ఈ వచనం గ్రంథంలో తీసుకునే పాత్ర

సూటిగా, స్పష్టంగా, బోధనాత్మకంగా రాయండి. పొడవైన బ్లాకులు వద్దు.

Begin.
`.trim();
}

/* ============================================================
  HISTORICAL CONTEXT PROMPTS (EN & TE NATIVE)
============================================================ */

function buildHistoricalContextPromptEN(v: VerseReference) {
  const genre = getBookGenre(v.book);

  return `
You are generating HISTORICAL CONTEXT for:
${v.book} ${v.chapter}:${v.verse}

Genre: ${genre}

FORMAT EXACTLY:

**Historical Context**
Write 2–4 tight scholarly paragraphs:
• historical setting
• culture + geopolitics
• authorship + audience
• genre significance
• themes relevant to this verse

Rules:
• No scripture quotations.
• Reference other biblical material only like "Genesis 1" (no verse numbers).
• Clean markdown.
• No long blocks.

Begin.
`.trim();
}

function buildHistoricalContextPromptTE(v: VerseReference) {
  const genre = getBookGenre(v.book);

  return `
క్రింది వాక్యానికి చారిత్రక నేపథ్యం తెలుగులో వివరించండి:

${v.book} ${v.chapter}:${v.verse}

జానర్: ${genre}

FORMAT:

**చారిత్రక నేపథ్యం**
2–4 చిన్న చిన్న పేరాలు రాయండి.

ప్రతి పేరాలో ఈ అంశాల్లో కొన్నింటిని కవర‍ చేయండి:
• చారిత్రక నేపథ్యం (కాలం, రాజులు, రాజకీయ పరిస్థితి)
• సంస్కృతి, సామాజిక పరిస్థితులు
• రచయిత, మొదటి పాఠకులు (audience)
• ఈ గ్రంథంలోని జానర్ ప్రాముఖ్యత
• ఈ వచనంతో సంబంధించిన ప్రధాన థీమ్‌లు

RULES:
• బైబిల్ వచనాలను కోట్ చేయకండి (సూచన రూపంలో మాత్రమే ఉంటే సరిపోతుంది).
• మార్క్‌డౌన్ హెడ్డింగ్ (**చారిత్రక నేపథ్యం**) అలాగే ఉంచండి.
• సూటిగా, పాయింట్‌కు దగ్గరగా రాయండి.

Begin.
`.trim();
}

/* ============================================================
  MAIN: getVerseAnalysis
============================================================ */

export const getVerseAnalysis = async (
  verse: VerseReference,
  section: "Cross-references" | "Historical Context" | "Interlinear",
  language: "EN" | "TE" = "EN"
) => {
  const baseKey = `${verse.book}-${verse.chapter}-${verse.verse}-${section}`;
  const cacheKey = `${baseKey}-${language}`;

  const cached = verseCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let prompt = "";
  const MODEL = "gemini-2.5-flash-lite";

  // Important design decision:
  // Interlinear is ALWAYS generated in EN.
  // Telugu interlinear is handled in the UI (VerseTools) using EN base text.
  if (section === "Interlinear") {
    const interlinearKey = `${baseKey}-EN`;
    const cachedInterlinear = verseCache.get(interlinearKey);
    if (cachedInterlinear !== undefined) return cachedInterlinear;

    prompt = buildInterlinearPrompt(verse.book, verse.chapter, verse.verse);
    const en = await safeGenerate(MODEL, prompt);
    verseCache.set(interlinearKey, en);
    return en;
  }

  // Cross-references + Historical Context
  if (section === "Cross-references") {
    prompt =
      language === "EN"
        ? buildCrossRefsPromptEN(verse)
        : buildCrossRefsPromptTE(verse);
  } else {
    // Historical Context
    prompt =
      language === "EN"
        ? buildHistoricalContextPromptEN(verse)
        : buildHistoricalContextPromptTE(verse);
  }

  const out = await safeGenerate(MODEL, prompt);
  verseCache.set(cacheKey, out);
  return out;
};

/* ============================================================
  SIMPLE FLASH GENERATOR
============================================================ */

export const flashGenerate = async (prompt: string) => {
  return safeGenerate("gemini-2.5-flash-lite", prompt);
};

/* ============================================================
  CHATBOT SUPPORT
============================================================ */

function getChat(mode: ChatMode): Chat {
  if (!chatInstances.has(mode)) {
    const aiInstance = getAiInstance();
    const chat = aiInstance.chats.create({
      model: mode,
      config: {
        systemInstruction:
          "You are an expert Bible scholar. Provide careful, text-aware explanations with references.",
      },
    });
    chatInstances.set(mode, chat);
  }
  return chatInstances.get(mode)!;
}

export const sendMessageToBot = async (
  message: string,
  history: any[],
  mode: ChatMode,
  lang: "EN" | "TE" = "EN"
) => {
  const langText =
    lang === "TE" ? "సమాధానం తెలుగులో ఇవ్వండి." : "Answer in English.";

  try {
    // Simple mode uses direct generate
    if (mode === "gemini-2.5-flash-lite") {
      const text = await safeGenerate(
        "gemini-2.5-flash-lite",
        `${message}\n\n${langText}`
      );
      return { text, sources: [] };
    }

    const chat = getChat(mode);
    const resp = await chat.sendMessage({
      message: `${message}\n\n${langText}`,
      history,
    } as any);

    return { text: (resp as any)?.text || "", sources: [] };
  } catch (err: any) {
    return { text: err.message || "AI error", sources: [] };
  }
};

/* ============================================================
  KEYWORD SEARCH
============================================================ */

export const searchBibleByKeyword = async (
  keyword: string
): Promise<string> => {
  try {
    const res = await safeGenerate(
      "gemini-2.5-flash-lite",
      `
Return ONLY Bible references related to "${keyword}".

Rules:
• Only references like: John 3:16; Romans 8:1–4
• No commentary.
• No extra text.
`.trim()
    );

    return res.replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
};
