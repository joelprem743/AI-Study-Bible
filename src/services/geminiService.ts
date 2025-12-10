// src/services/geminiService.ts
// VerseTools + Chatbot helpers.
// All AI calls now go through backend APIs (Gemini/Groq), no keys on frontend.

import { VerseReference } from "..";

/* ============================================================
  FRONTEND → BACKEND CALL HELPER (VerseTools pipeline)
============================================================ */

async function callVerseToolsBackend(prompt: string, cacheKey: string): Promise<string> {
  const res = await fetch("/api/verse-tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, cacheKey }),
  });

  const raw = await res.text();
let data;

try {
  data = raw ? JSON.parse(raw) : null;
} catch {
  throw new Error("Backend returned invalid JSON: " + raw);
}


  if (!res.ok) {
    const msg = data?.error || `VerseTools AI backend error: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  const text = (data?.text ?? "").toString().trim();
  return text;
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

## Hebrew Text
<raw MT Hebrew>

---

## English Transliteration
<ASCII transliteration>

---

## Smooth English Translation
<one clear sentence>

---

## Word-by-Word Analysis
- HebrewWord (ascii-translit) — english-gloss
- HebrewWord (ascii-translit) — english-gloss
- HebrewWord (ascii-translit) — english-gloss

End with a short 1–2 sentence note on how this verse fits the surrounding passage.
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

## Greek Text
<raw Greek text>

---

## English Transliteration
<ASCII transliteration>

---

## Smooth English Translation
<one clear sentence>

---

## Word-by-Word Analysis
- GreekWord (ascii-translit) — english-gloss
- GreekWord (ascii-translit) — english-gloss
- GreekWord (ascii-translit) — english-gloss

End with a short 1–2 sentence note on how this verse fits the surrounding passage.
`.trim();
}

/* ============================================================
  CROSS-REFERENCES PROMPTS (EN & TE NATIVE)
============================================================ */

function buildCrossRefsPromptEN(v: VerseReference) {
  return `
You are generating CROSS-REFERENCES + SCHOLARLY COMMENTARY for:
${v.book} ${v.chapter}:${v.verse}

Format the answer as clean Markdown with clear headings and bullet points.

FORMAT EXACTLY:

## Cross-References (With Explanations)
Provide 3–7 bullet points.
Each bullet MUST follow this minimal strict format:

- BookName 1:1 — one short sentence explaining the thematic link.

Rules:
• NO scripture quotations.
• NO invented references.
• NO ANE mythology unless directly connected.

---

## Scholarly Commentary
Write 2–4 short paragraphs.
Each paragraph 2–4 sentences.
Cover:
• historical setting
• linguistic insight
• theological theme
• literary function

No long blocks. No quotes. Use **bold** for key doctrinal or thematic terms.
`.trim();
}

function buildCrossRefsPromptTE(v: VerseReference) {
  return `
క్రింది వచనానికి సంబంధించి క్రాస్ రిఫరెన్సులు మరియు పండితుల వ్యాఖ్యానం తెలుగులో ఇవ్వండి:

${v.book} ${v.chapter}:${v.verse}

సమాధానం తప్పనిసరిగా Markdown ఫార్మాట్‌లో ఉండాలి:

## సంబంధిత వచనాలు (వివరణలతో)
3–7 బుల్లెట్ పాయింట్లు రాయండి.
ప్రతి బుల్లెట్ ఈ ఫార్మాట్‌లో ఉండాలి:

- పుస్తకనామం 1:1 — ఈ వచనంతో ఉన్న థీమాటిక్ / ఆలోచనా సంబంధాన్ని తెలుగులో ఒక చిన్న వాక్యంతో వివరించండి.

RULES:
• వచనాలను కోట్ చేయకండి (పరామర్శ మాత్రమే చేయండి).
• బైబిల్‌లో లేని ఊహాత్మక రిఫరెన్సులు వద్దు.
• ఒక్కో బుల్లెట్ ఒకే వాక్యంగా ఉండాలి.

---

## పండితుల వ్యాఖ్యానం
2–4 చిన్న పేరాలు రాయండి.
ప్రతి పేరా 2–4 వాక్యాలు మాత్రమే.

కవర చేయాల్సిన అంశాలు:
• చారిత్రక నేపథ్యం
• సాంస్కృతిక / సామాజిక పరిస్థితి
• భాషా పరమైన సూచనలు
• థియాలజికల్ థీమ్
• ఈ వచనం గ్రంథంలో తీసుకునే పాత్ర

సూటిగా, స్పష్టంగా, బోధనాత్మకంగా రాయండి. పొడవైన బ్లాకులు వద్దు.
కీలక పదాలను **బోల్డ్** గా హైలైట్ చేయండి.
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

Format the answer as well-structured Markdown.

FORMAT EXACTLY:

## Historical Context
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
• Use **bold** for key concepts and dates where relevant.
`.trim();
}

function buildHistoricalContextPromptTE(v: VerseReference) {
  const genre = getBookGenre(v.book);

  return `
క్రింది వచనానికి చారిత్రక నేపథ్యం తెలుగులో వివరించండి:

${v.book} ${v.chapter}:${v.verse}

జానర్: ${genre}

సమాధానం Markdown ఫార్మాట్‌లో ఉండాలి:

## చారిత్రక నేపథ్యం
2–4 చిన్న చిన్న పేరాలు రాయండి.

ప్రతి పేరాలో ఈ అంశాల్లో కొన్నింటిని కవర‍ చేయండి:
• చారిత్రక నేపథ్యం (కాలం, రాజులు, రాజకీయ పరిస్థితి)
• సంస్కృతి, సామాజిక పరిస్థితులు
• రచయిత, మొదటి పాఠకులు (audience)
• ఈ గ్రంథంలోని జానర్ ప్రాముఖ్యత
• ఈ వచనంతో సంబంధించిన ప్రధాన థీమ్‌లు

RULES:
• బైబిల్ వచనాలను కోట్ చేయకండి (సూచన రూపంలో మాత్రమే ఉంటే సరిపోతుంది).
• హెడ్డింగ్‌ల కోసం ## వాడండి.
• కీలక పదాలను **బోల్డ్** గా హైలైట్ చేయండి.
• సూటిగా, పాయింట్‌కు దగ్గరగా రాయండి.
`.trim();
}

/* ============================================================
  MAIN: getVerseAnalysis (VerseTools → backend)
============================================================ */

// Frontend-level cache (per session) to avoid extra network hits
const verseCache = new Map<string, string>();

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

  if (section === "Interlinear") {
    const interlinearKey = `${baseKey}-EN`;
    const cachedInterlinear = verseCache.get(interlinearKey);
    if (cachedInterlinear !== undefined) return cachedInterlinear;

    prompt = buildInterlinearPrompt(verse.book, verse.chapter, verse.verse);
    const en = await callVerseToolsBackend(prompt, interlinearKey);
    verseCache.set(interlinearKey, en);
    return en;
  }

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

  const out = await callVerseToolsBackend(prompt, cacheKey);
  verseCache.set(cacheKey, out);
  return out;
};

/* ============================================================
  CHATBOT SUPPORT (uses /api/llama-chat on backend)
============================================================ */

export const sendMessageToLlama = async (
  message: string,
  history: any[],
  lang: "EN" | "TE" = "EN"
) => {
  const res = await fetch("/api/llama-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `${message}
      
      Format the entire answer in clean Markdown. Use:
      - headings (##)
      - bullet points
      - short paragraphs
      - **bold** for important terms
      
      Do NOT mix paragraph and list formatting in the same block.`,
      history,
      lang,
    }),
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // non-JSON, ignore and fall through
  }

  if (!res.ok) {
    const errMsg =
      (data && data.error) ||
      `LLaMA API error: ${res.status} ${res.statusText} ${raw || ""}`.trim();
    throw new Error(errMsg);
  }

  return {
    text: data?.text ?? "",
    sources: data?.sources ?? [],
  };
};

/* ============================================================
  SIMPLE FLASH GENERATOR (generic prompt → backend)
============================================================ */

export const flashGenerate = async (prompt: string) => {
  const cacheKey = `flash-${prompt.slice(0, 100)}`;
  return callVerseToolsBackend(prompt, cacheKey);
};

/* ============================================================
  KEYWORD SEARCH (also via backend)
============================================================ */

export const searchBibleByKeyword = async (
  keyword: string
): Promise<string> => {
  try {
    const prompt = `
Return ONLY Bible references related to "${keyword}".

Rules:
• Only references like: John 3:16; Romans 8:1–4
• No commentary.
• No extra text.
`.trim();

    const cacheKey = `kw-${keyword.toLowerCase()}`;
    const res = await callVerseToolsBackend(prompt, cacheKey);

    return res.replace(/\s+/g, " ").trim();
  } catch {
    // If AI is disabled or quota is gone, just return empty.
    return "";
  }
};
export async function getVerseToolsFromBackend(payload: {
  type: "cross" | "historical" | "interlinear";
  book: string;
  chapter: number;
  verse: number;
  lang: "EN" | "TE";
}) {
  const res = await fetch("/api/verse-tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
let data;

try {
  data = raw ? JSON.parse(raw) : null;
} catch {
  throw new Error("Backend returned invalid JSON: " + raw);
}

  if (!res.ok) throw new Error(data.error || "Backend error");

  return data.text;
}
