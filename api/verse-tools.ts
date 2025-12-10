// api/verse-tools.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

/* -----------------------------
   INIT & VALIDATION
------------------------------ */

let ai: GoogleGenAI | null = null;

function getAi() {
  if (!ai) {
    const key = process.env.VITE_API_KEY;
    if (!key) {
      throw new Error("Missing Gemini API Key: VITE_API_KEY");
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
   PROMPT BUILDERS
------------------------------ */

function buildCrossRefsPrompt(book: string, chapter: number, verse: number, lang: "EN" | "TE") {
  if (lang === "TE") {
    return `
${book} ${chapter}:${verse} వచనానికి సంబంధించిన క్రాస్ రిఫరెన్సులు తెలుగులో ఇవ్వండి.

**సంబంధిత వచనాలు (వివరణలతో)**
- పుస్తకం 1:1 — ఈ వచనంతో ఉన్న థీమ్ సంబంధం వివరించండి.
- పుస్తకం 1:2 — చిన్న వివరణ ఇవ్వండి.
- పుస్తకం 1:3 — చిన్న వివరణ ఇవ్వండి.

---

**పండితుల వ్యాఖ్యానం**
2–4 పేరాలు రాయండి.
ప్రతి పేరా 2–4 వాక్యాలుగా ఉండాలి.

Markdown మాత్రమే వాడండి.
    `;
  }

  return `
Provide CROSS REFERENCES for:

${book} ${chapter}:${verse}

**Cross-References**
- Book 1:1 — explain theme connection.
- Book 1:2 — explain connection.
- Book 1:3 — explain connection.

---

**Scholarly Commentary**
Write 2–4 paragraphs, each 2–4 sentences.

Return clean Markdown only.
  `;
}

function buildHistoricalContextPrompt(book: string, chapter: number, verse: number, lang: "EN" | "TE") {
  if (lang === "TE") {
    return `
${book} ${chapter}:${verse} వచనానికి చారిత్రక నేపథ్యం తెలుగులో ఇవ్వండి.

**చారిత్రక నేపథ్యం**
2–4 పేరాలు రాయండి.
ప్రతి పేరా 2–4 వాక్యాలు మాత్రమే.

మార్క్‌డౌన్ మాత్రమే వాడండి.
`;
  }

  return `
Provide HISTORICAL CONTEXT for:

${book} ${chapter}:${verse}

**Historical Context**
2–4 paragraphs. 
No Bible quotations. Use Markdown.
`;
}

function buildInterlinearPrompt(book: string, chapter: number, verse: number) {
  return `
Provide INTERLINEAR ANALYSIS for:

${book} ${chapter}:${verse}

**1. Original Text**
(Provide Greek or Hebrew)

---

**2. Transliteration**

---

**3. Smooth Translation**

---

**4. Word-by-Word Analysis**
word — gloss
word — gloss

Only Markdown.
  `;
}

/* -----------------------------
   MAIN API HANDLER
------------------------------ */

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }
  
      const { prompt, cacheKey, type, book, chapter, verse, lang = "EN" } = req.body || {};
  
      // CASE 1: RAW PROMPT (flashGenerate, interlinear translation, TE conversion, etc)
      if (prompt) {
        const output = await safeGenerate(prompt);
        return res.status(200).json({ text: output });
      }
  
      // CASE 2: FULL ANALYSIS REQUEST
      if (!type || !book || !chapter || !verse) {
        return res.status(400).json({ error: "Missing parameters." });
      }
  
      let p = "";
  
      switch (type) {
        case "cross":
          p = buildCrossRefsPrompt(book, chapter, verse, lang);
          break;
        case "historical":
          p = buildHistoricalContextPrompt(book, chapter, verse, lang);
          break;
        case "interlinear":
          p = buildInterlinearPrompt(book, chapter, verse);
          break;
        default:
          return res.status(400).json({ error: "Invalid type." });
      }
  
      const out = await safeGenerate(p);
      return res.status(200).json({ text: out });
  
    } catch (err: any) {
        console.error("VerseTools API Error:", err);

        return res.status(500).json({
          error: err?.message || "Internal Error",
          stack: err?.stack || "",
        });
        
    }
  }
  
