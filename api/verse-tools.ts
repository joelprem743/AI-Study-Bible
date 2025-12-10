import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

/* -----------------------------
   INIT & LOW-LEVEL HELPERS
------------------------------ */

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

/* -----------------------------
   BIBLE METADATA
------------------------------ */

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

function isNewTestament(book: string) {
  return NT_BOOKS.has(book);
}

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

type SimpleRef = { book: string; chapter: number; verse: number };

/* -----------------------------
   PROMPT BUILDERS
------------------------------ */

function buildInterlinearPrompt(book: string, chapter: number, verse: number) {
    const ref = `${book} ${chapter}:${verse}`;
  
    if (!isNewTestament(book)) {
      // Old-Testament: Hebrew
      return `
  You are generating a Hebrew interlinear analysis for the verse: ${ref}.
  
  STRICT RULES:
  1. No introductions or extra commentary.
  2. Use EXACTLY the section labels below starting with "1.", "2.", "3.", "4.".
  3. Hebrew text MUST remain untouched.
  4. Transliteration MUST be ASCII only.
  
  FORMAT (FOLLOW THIS EXACTLY):
  
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
  HebrewWord (ascii-translit) — english-gloss
  HebrewWord (ascii-translit) — english-gloss
  HebrewWord (ascii-translit) — english-gloss
  
  END.
  `.trim();
    }
  
    // New-Testament: Greek
    return `
  You are generating a Greek interlinear analysis for the verse: ${ref}.
  
  STRICT RULES:
  1. No introductions or extra commentary.
  2. Use EXACTLY the section labels below starting with "1.", "2.", "3.", "4.".
  3. Keep accents and breathings in the Greek text.
  4. Transliteration MUST be ASCII only.
  
  FORMAT (FOLLOW THIS EXACTLY):
  
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
  GreekWord (ascii-translit) — english-gloss
  GreekWord (ascii-translit) — english-gloss
  GreekWord (ascii-translit) — english-gloss
  
  END.
  `.trim();
  }
  
function buildCrossRefsPromptEN(v: SimpleRef) {
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

function buildCrossRefsPromptTE(v: SimpleRef) {
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

function buildHistoricalContextPromptEN(v: SimpleRef) {
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

function buildHistoricalContextPromptTE(v: SimpleRef) {
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

/* -----------------------------
   SIMPLE IN-MEMORY CACHE
------------------------------ */

const cache = new Map<string, string>();

/* -----------------------------
   MAIN HANDLER
------------------------------ */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { type, book, chapter, verse, lang = "EN" } = req.body || {};

    if (!type || !book || !chapter || !verse) {
      return res
        .status(400)
        .json({ error: "Missing parameters (type, book, chapter, verse)." });
    }

    const chapNum = Number(chapter);
    const verseNum = Number(verse);
    if (!chapNum || !verseNum) {
      return res.status(400).json({ error: "chapter and verse must be numbers." });
    }

    const key = `${type}:${book}:${chapNum}:${verseNum}:${lang}`;
    const cached = cache.get(key);
    if (cached) {
      return res.status(200).json({ text: cached, cached: true });
    }

    const v: SimpleRef = { book, chapter: chapNum, verse: verseNum };

    let prompt: string;

    switch (type) {
      case "cross":
        prompt = lang === "TE" ? buildCrossRefsPromptTE(v) : buildCrossRefsPromptEN(v);
        break;
      case "historical":
        prompt =
          lang === "TE"
            ? buildHistoricalContextPromptTE(v)
            : buildHistoricalContextPromptEN(v);
        break;
      case "interlinear":
        // Interlinear is always generated in EN; frontend handles Telugu view.
        prompt = buildInterlinearPrompt(book, chapNum, verseNum);
        break;
      default:
        return res.status(400).json({ error: "Invalid type." });
    }

    const output = await safeGenerate(prompt);
    cache.set(key, output);

    return res.status(200).json({ text: output });
  } catch (err: any) {
    console.error("VerseTools API Error:", err);
    return res.status(500).json({ error: err?.message || "Internal Error" });
  }
}
