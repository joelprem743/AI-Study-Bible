// src/components/VerseTools.tsx
import React, { useEffect, useRef, useState } from "react";
import { getVerseAnalysis, flashGenerate } from "../services/geminiService";
import { isNewTestament } from "../services/geminiService";
import type { Verse, VerseReference } from "../types";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { getInterlinearData } from "../services/bibleService";

interface VerseToolsProps {
  verseRef: VerseReference;
  verseData: Verse;
  englishVersion: string;
  onClose?: () => void;
}

type Tab = "Interlinear" | "Cross-references" | "Historical Context" | "Notes";

/** Loading skeleton */
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
  </div>
);

/**
 * Sanitization (Option B - Semi-Clean)
 */
function sanitizeToAsciiOptionB(input: string): string {
  if (!input) return "";

  const map: [RegExp, string][] = [
    [/ā/g, "aa"],
    [/ē/g, "ee"],
    [/ī/g, "ii"],
    [/ō/g, "oo"],
    [/ū/g, "uu"],
    [/ə/g, "a"],
    [/ʿ|ʾ|ʼ|’|`/g, "'"],
    [/ḥ/g, "h"],
    [/ṭ/g, "t"],
    [/ṣ/g, "s"],
    [/š|ś/g, "sh"],
    [/ḏ/g, "d"],
    [/ṯ/g, "t"],
    [/ḇ/g, "b"],
    [/ẓ/g, "z"],
    [/ā́/g, "aa"],
    [/á/g, "a"],
    [/à/g, "a"],
    [/â/g, "a"],
    [/ê/g, "e"],
    [/ô/g, "o"],
    [/î/g, "i"],
    [/û/g, "u"],
    [/\p{M}/gu, ""],
  ];

  let s = input;
  for (const [rx, repl] of map) {
    s = s.replace(rx, repl);
  }

  s = s.replace(/[^A-Za-z0-9'\-\s]/g, "");
  s = s.replace(/'+/g, "'");
  s = s.replace(/([A-Za-z0-9])'([A-Za-z0-9])/g, "$1-$2");
  s = s.replace(/-+/g, "-");
  s = s.trim();

  return s;
}

/**
 * Heuristic transliteration: Latin ASCII transliteration -> Telugu script
 */
function transliterateLatinToTelugu(input: string): string {
  if (!input) return "";

  let s = input.trim();

  // Rules: longer patterns first. This is conservative.
  const rules: [RegExp, string][] = [
    // Greek-like/consonant clusters (conservative)
    [/(chh|Chh|CHH)/g, "ఛ్‍"],
    [/(kh|Kh|KH)/g, "ఖ"],
    [/(gh|Gh|GH)/g, "ఘ"],
    [/(ph|Ph|PH)/g, "ఫ"],
    [/(th|Th|TH)/g, "థ"],
    [/(dh|Dh|DH)/g, "ధ"],
    [/(sh|Sh|SH)/g, "ష"],
    [/(ch|Ch|CH)/g, "చ"],
    [/(ts|Ts|TS)/g, "త్స"],
    [/(ng|Ng|NG)/g, "ంగ"],
    [/(ny|Ny|NY)/g, "న్య"],

    // single consonants
    [/[bB]/g, "బ"],
    [/[cC]/g, "క"],
    [/[dD]/g, "ద"],
    [/[fF]/g, "ఫ"],
    [/[gG]/g, "గ"],
    [/[hH]/g, "హ"],
    [/[jJ]/g, "జ"],
    [/[kK]/g, "క"],
    [/[lL]/g, "ల"],
    [/[mM]/g, "మ"],
    [/[nN]/g, "న"],
    [/[pP]/g, "ప"],
    [/[rR]/g, "ర"],
    [/[sS]/g, "స"],
    [/[tT]/g, "త"],
    [/[vV]/g, "వ"],
    [/[wW]/g, "వ"],
    [/[xX]/g, "క్స"],
    [/[yY]/g, "య"],
    [/[zZ]/g, "జ"],

    // vowels / vowel signs (long first)
    [/(aa|AA)/g, "ా"],
    [/(ii|II)/g, "ీ"],
    [/(uu|UU)/g, "ూ"],
    [/(ai|Ai|AI)/g, "ై"],
    [/(au|Au|AU)/g, "ౌ"],
    [/(e|E)/g, "ె"],
    [/(o|O)/g, "ొ"],
    [/(i|I)/g, "ి"],
    [/(u|U)/g, "ు"],
    // a/A often inherent; remove explicit 'a'
    [/(a|A)/g, ""],

    // punctuation/spaces
    [/-/g, "-"],
  ];

  for (const [rx, repl] of rules) s = s.replace(rx, repl);
  s = s.replace(/\s+/g, " ").trim();

  // If vowel sign occurs at the beginning, prefix అ
  s = s.replace(/(^|\s)[ాీూెొైౌ]/g, (m) => {
    const ch = m.trim();
    return (m.startsWith(" ") ? " అ" : "అ") + ch;
  });

  return s;
}

/**
 * Extract English transliteration block (Section 2) from AI output
 */
function extractEnglishTranslitBlock(aiText: string): { englishBlock: string; withoutEnglish: string } {
  const rx = /2\.\s*English Transliteration\s*[:\n]*([\s\S]*?)\n(?=3\.)/i;
  const m = aiText.match(rx);
  if (m && m[1]) {
    const englishBlock = m[1].trim();
    const withoutEnglish = aiText.replace(m[0], "");
    return { englishBlock, withoutEnglish };
  }

  const rx2 = /2\.\s*English Transliteration\s*[:\n]*([\s\S]*)$/i;
  const m2 = aiText.match(rx2);
  if (m2 && m2[1]) {
    const englishBlock = m2[1].trim();
    const withoutEnglish = aiText.replace(m2[0], "");
    return { englishBlock, withoutEnglish };
  }

  return { englishBlock: "", withoutEnglish: aiText };
}

/**
 * Replace parenthetical transliteration in word-by-word with Telugu equivalents
 */
function replaceParentheticalTranslitsWithTelugu(aiText: string): string {
  return aiText.replace(/\(([A-Za-z0-9'\- ]+)\)/g, (_match, p1) => {
    const cleaned = sanitizeToAsciiOptionB(p1.trim());
    const conv = transliterateLatinToTelugu(cleaned);
    return `(${conv || p1})`;
  });
}

/**
 * Build Telugu transliteration full-line from English block
 */
function buildTeluguTranslitFromEnglishBlock(engBlock: string): string {
  if (!engBlock) return "";

  const sanitized = engBlock
    .split(/\r?\n/)
    .map((l) => sanitizeToAsciiOptionB(l.trim()))
    .filter(Boolean)
    .join(" ");

  const words = sanitized.split(/\s+/);
  const convWords = words.map((w) => transliterateLatinToTelugu(w));
  return convWords.join(" ");
}

/**
 * VerseTools component
 */
export const VerseTools: React.FC<VerseToolsProps> = ({ verseRef, verseData, englishVersion, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>("Interlinear");
  const [language, setLanguage] = useState<"EN" | "TE">("EN");

  // analysis holds localized (possibly Telugu) text for each tab
  const [analysis, setAnalysis] = useState<Record<Tab, string | null>>({
    Interlinear: null,
    "Cross-references": null,
    "Historical Context": null,
    Notes: null,
  });

  // originalAnalysis holds canonical English interlinear (with raw Hebrew/Greek)
  const [originalAnalysis, setOriginalAnalysis] = useState<Record<Tab, string | null>>({
    Interlinear: null,
    "Cross-references": null,
    "Historical Context": null,
    Notes: null,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);

  const verseId = `${verseRef.book}-${verseRef.chapter}-${verseRef.verse}`;
  const [userNotes, setUserNotes] = useLocalStorage<string>(`${verseId}-notes`, "");

  const englishText = verseData.text[englishVersion as keyof typeof verseData.text] || verseData.text.KJV;

  // Local cache per component by (tab::lang)
  const localCache = useRef(new Map<string, string>());

  useEffect(() => {
    setAnalysis({
      Interlinear: null,
      "Cross-references": null,
      "Historical Context": null,
      Notes: userNotes,
    });
    setOriginalAnalysis({
      Interlinear: null,
      "Cross-references": null,
      "Historical Context": null,
      Notes: userNotes,
    });
    setActiveTab("Interlinear");
    setErrorMsg("");
    setShowOriginal(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseRef]);

  const buildCacheKey = (tab: Tab, lang: "EN" | "TE") => `${verseId}::${tab}::${lang}`;

  const loadTab = async (tab: Tab) => {
    if (tab === "Notes") return;

    const cacheKey = buildCacheKey(tab, language);

    if (localCache.current.has(cacheKey)) {
      setAnalysis((p) => ({ ...p, [tab]: localCache.current.get(cacheKey)! }));
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // Always get canonical English output from the service (cached per EN)
      const enCacheKey = buildCacheKey(tab, "EN");
      let enResult = localCache.current.get(enCacheKey) ?? null;

      if (!enResult) {
        const res = await getVerseAnalysis(verseRef, tab, "EN");
        enResult = res || "";
        localCache.current.set(enCacheKey, enResult);
        // store originalAnalysis for toggling
        setOriginalAnalysis((p) => ({ ...p, [tab]: enResult }));
      } else {
        // if we had cached EN earlier, ensure originalAnalysis has it
        setOriginalAnalysis((p) => ({ ...p, [tab]: enResult }));
      }

      if (language === "EN") {
        localCache.current.set(cacheKey, enResult);
        setAnalysis((p) => ({ ...p, [tab]: enResult }));
        setLoading(false);
        return;
      }

      // language === "TE" => produce Telugu-mode interlinear (localized)
      // 1) Extract English transliteration block and remove it
      const { englishBlock, withoutEnglish } = extractEnglishTranslitBlock(enResult);

      // 2) Sanitize English transliteration block (Option B)
      const sanitizedEnglishBlock = sanitizeToAsciiOptionB(englishBlock);

      // 3) Build Telugu transliteration line for entire verse
      const teluguFullTranslit = buildTeluguTranslitFromEnglishBlock(sanitizedEnglishBlock);

      // 4) Replace parenthetical translits in the remainder with Telugu equivalents
      let working = replaceParentheticalTranslitsWithTelugu(withoutEnglish);

      // 5) Insert Telugu transliteration block as Section 2 with appropriate heading.
      const originalHeadingRx = /(1\.\s*(Hebrew|Greek)\s*Text\s*[:\n]*)([\s\S]*?)(?=\n\s*2\.|$)/i;
      let finalWithTeluguInserted = working;

      const isNT = isNewTestament(verseRef.book);
      const originalHeadingTelugu = isNT ? "గ్రీకు వచనం:" : "హీబ్రూ వచనం:";
      const translitHeadingTelugu = "2. తెలుగు లిప్యంతరీకరణ:";

      // Attempt to insert after the original language block if present
      const sec1Rx = /(1\.\s*(Hebrew|Greek)\s*Text\s*[:\n]*)([\s\S]*?)(?=\n\s*2\.|\n\s*3\.|$)/i;
      if (sec1Rx.test(working)) {
        finalWithTeluguInserted = working.replace(sec1Rx, (_m, heading, _lang, block) => {
          const insert = `1. ${_lang} Text:\n${block.trim()}\n\n${translitHeadingTelugu}\n${teluguFullTranslit}\n\n`;
          // prepend Telugu heading in Telugu script for clarity
          return `1. ${originalHeadingTelugu}\n${block.trim()}\n\n2. తెలుగు లిప్యంతరీకరణ:\n${teluguFullTranslit}\n\n`;

        });
      } else {
        // fallback: prepend transliteration block
        finalWithTeluguInserted = `2. తెలుగు లిప్యంతరీకరణ:\n${teluguFullTranslit}\n\n` + working;
      }

      // 6) Translate only the English content to Telugu (keep original-language block and Telugu transliteration intact).
      const translatePrompt = `Translate the following Bible study content to natural, fluent Telugu.
- DO NOT modify raw ${isNT ? "Greek" : "Hebrew"} text or any content that is already in Telugu script.
- ONLY translate English sentences, explanations, and word-meanings into Telugu.
- Also convert section headers to Telugu as follows:
  1. '${isNT ? "Greek Text" : "Hebrew Text"}' -> '${originalHeadingTelugu}'
  3. 'Smooth English Translation' -> 'సరళమైన తెలుగు అనువాదం:'
  4. 'Word-by-Word Analysis' -> 'పదాల వారీగా విశ్లేషణ:'
- Preserve section numbering and overall structure.

----BEGIN CONTENT----
${finalWithTeluguInserted}
----END CONTENT----

Return only the translated content (no commentary).`;

      const translated = await flashGenerate(translatePrompt);
      const finalText = (translated || "").trim() || finalWithTeluguInserted;

      // Cache and set
      localCache.current.set(cacheKey, finalText);
      setAnalysis((p) => ({ ...p, [tab]: finalText }));
    } catch (err: any) {
      console.error("VerseTools loadTab error:", err);
      setErrorMsg(language === "TE" ? "కంటెంట్ లోడ్ చేయడంలో సమస్య వచ్చింది." : "Failed to load content.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "Notes" && analysis[activeTab] === null) loadTab(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, language]);

  useEffect(() => {
    if (activeTab !== "Notes") loadTab(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const tabs: Tab[] = ["Interlinear", "Cross-references", "Historical Context", "Notes"];

  return (
    <div className="p-4 md:p-6 h-full flex flex-col relative">
      {onClose && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 z-10 p-2"
          aria-label="Close verse tools"
        >
          <i className="fas fa-times text-2xl"></i>
        </button>
      )}

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {verseRef.book} {verseRef.chapter}:{verseRef.verse}
          </h2>
          <p className="mt-1 text-gray-700 dark:text-gray-300 italic">"{englishText}"</p>
        </div>

        {/* Language switch + show original toggle */}
        <div className="flex items-center gap-2 mr-10 md:mr-0">
          <label className="text-sm text-gray-600 dark:text-gray-300">Language</label>
          <div>
            <button
              onClick={() => {
                setLanguage((l) => (l === "EN" ? "TE" : "EN"));
                setShowOriginal(false);
              }}
              className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
              title="Toggle language"
            >
              {language}
            </button>
          </div>

        
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setShowOriginal(false);
              }}
              className={`${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              {language === "TE"
                ? tab === "Interlinear"
                  ? "ఇంటర్‌లీనియర్"
                  : tab === "Cross-references"
                  ? "సంబంధిత వచనాలు"
                  : tab === "Historical Context"
                  ? "చారిత్రక నేపథ్యం"
                  : "గమనికలు"
                : tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-grow overflow-y-auto pr-2">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans">
            {activeTab === "Notes" ? (
              <textarea
                className="w-full h-64 p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder={language === "TE" ? "ఈ వచనం పై మీ వ్యక్తిగత గమనికలు..." : "Your personal notes on this verse..."}
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
              />
            ) : errorMsg ? (
              <p className="text-red-500">{errorMsg}</p>
            ) : showOriginal ? (
              <pre className="whitespace-pre-wrap">{originalAnalysis[activeTab] ?? analysis[activeTab] ?? ""}</pre>
            ) : (
              <pre className="whitespace-pre-wrap">{analysis[activeTab] ?? ""}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
