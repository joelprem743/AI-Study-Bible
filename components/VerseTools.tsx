// src/components/VerseTools.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { getVerseAnalysis, flashGenerate, isNewTestament } from "../services/geminiService";
import type { Verse, VerseReference } from "../types";
import { useLocalStorage } from "../hooks/useLocalStorage";

/* ---------------------------------------------------------
   Loading Skeleton
--------------------------------------------------------- */
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
  </div>
);

/* ---------------------------------------------------------
   Sanitization + Transliteration Helpers
--------------------------------------------------------- */

function sanitizeToAsciiOptionB(input: string): string {
  if (!input) return "";

  const map: [RegExp, string][] = [
    [/ā/g, "aa"], [/ē/g, "ee"], [/ī/g, "ii"], [/ō/g, "oo"], [/ū/g, "uu"],
    [/ə/g, "a"], [/ʿ|ʾ|ʼ|’|`/g, "'"], [/ḥ/g, "h"], [/ṭ/g, "t"],
    [/ṣ/g, "s"], [/š|ś/g, "sh"], [/ḏ/g, "d"], [/ṯ/g, "t"], [/ḇ/g, "b"],
    [/ẓ/g, "z"], [/ā́/g, "aa"], [/á|à|â/g, "a"], [/ê/g, "e"],
    [/ô/g, "o"], [/î/g, "i"], [/û/g, "u"], [/\p{M}/gu, ""]
  ];

  let s = input;
  for (const [rx, repl] of map) s = s.replace(rx, repl);

  s = s.replace(/[^A-Za-z0-9'\-\s]/g, "");
  s = s.replace(/'+/g, "'");
  s = s.replace(/([A-Za-z0-9])'([A-Za-z0-9])/g, "$1-$2");
  s = s.replace(/-+/g, "-");

  return s.trim();
}

function transliterateLatinToTelugu(input: string): string {
  if (!input) return "";

  let s = input.trim();

  const rules: [RegExp, string][] = [
    [/(chh)/gi, "ఛ్‍"], [/(kh)/gi, "ఖ"], [/(gh)/gi, "ఘ"], [/(ph)/gi, "ఫ"],
    [/(th)/gi, "థ"], [/(dh)/gi, "ధ"], [/(sh)/gi, "ష"], [/(ch)/gi, "చ"],
    [/(ts)/gi, "త్స"], [/(ng)/gi, "ంగ"], [/(ny)/gi, "న్య"],

    [/[bB]/g, "బ"], [/[cC]/g, "క"], [/[dD]/g, "ద"], [/[fF]/g, "ఫ"],
    [/[gG]/g, "గ"], [/[hH]/g, "హ"], [/[jJ]/g, "జ"], [/[kK]/g, "క"],
    [/[lL]/g, "ల"], [/[mM]/g, "మ"], [/[nN]/g, "న"], [/[pP]/g, "ప"],
    [/[rR]/g, "ర"], [/[sS]/g, "స"], [/[tT]/g, "త"], [/[vV]/g, "వ"],
    [/[wW]/g, "వ"], [/[xX]/g, "క్స"], [/[yY]/g, "య"], [/[zZ]/g, "జ"],

    [/(aa)/gi, "ా"], [/(ii)/gi, "ీ"], [/(uu)/gi, "ూ"],
    [/(ai)/gi, "ై"], [/(au)/gi, "ౌ"], [/(e)/g, "ె"], [/(o)/g, "ొ"],
    [/(i)/g, "ి"], [/(u)/g, "ు"], [/(a)/g, ""],
  ];

  for (const [rx, repl] of rules) s = s.replace(rx, repl);
  s = s.replace(/\s+/g, " ").trim();

  return s.replace(/(^|\s)[ాీూెొైౌ]/g, (m) =>
    (m.startsWith(" ") ? " అ" : "అ") + m.trim()
  );
}

function extractEnglishTranslitBlock(aiText: string) {
  const rx = /2\.\s*English Transliteration\s*[:\n]*([\s\S]*?)\n(?=3\.)/i;
  const m = aiText.match(rx);
  if (m?.[1]) {
    return { englishBlock: m[1].trim(), withoutEnglish: aiText.replace(m[0], "") };
  }
  return { englishBlock: "", withoutEnglish: aiText };
}

function replaceParentheticalTranslitsWithTelugu(aiText: string) {
  return aiText.replace(/\(([A-Za-z0-9'\- ]+)\)/g, (_match, p1) => {
    const cleaned = sanitizeToAsciiOptionB(p1.trim());
    const conv = transliterateLatinToTelugu(cleaned);
    return `(${conv || p1})`;
  });
}

function buildTeluguTranslitFromEnglishBlock(engBlock: string): string {
  if (!engBlock) return "";
  const sanitized = engBlock
    .split(/\r?\n/)
    .map((l) => sanitizeToAsciiOptionB(l.trim()))
    .filter(Boolean)
    .join(" ");

  return sanitized
    .split(/\s+/)
    .map((w) => transliterateLatinToTelugu(w))
    .join(" ");
}

/* ---------------------------------------------------------
   Component
--------------------------------------------------------- */

type Tab = "Interlinear" | "Cross-references" | "Historical Context" | "Notes";

export const VerseTools: React.FC<{
  verseRef: VerseReference;
  verseData: Verse;
  englishVersion: string;
  onClose?: () => void;
}> = ({ verseRef, verseData, englishVersion, onClose }) => {

  const [activeTab, setActiveTab] = useState<Tab>("Interlinear");
  const [language, setLanguage] = useState<"EN" | "TE">("EN");
  const [analysis, setAnalysis] = useState<Record<Tab, string | null>>({
    Interlinear: null,
    "Cross-references": null,
    "Historical Context": null,
    Notes: null,
  });
  const [originalAnalysis, setOriginalAnalysis] = useState<Record<Tab, string | null>>({
    Interlinear: null,
    "Cross-references": null,
    "Historical Context": null,
    Notes: null,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const verseId = `${verseRef.book}-${verseRef.chapter}-${verseRef.verse}`;
  const [userNotes, setUserNotes] = useLocalStorage<string>(`${verseId}-notes`, "");

  const localCache = useRef(new Map<string, string>());

  const englishText =
    verseData.text[englishVersion as keyof typeof verseData.text] ||
    verseData.text.KJV;

  const buildKey = (tab: Tab, lang: "EN" | "TE") =>
    `${verseId}::${tab}::${lang}`;

  /* ---------------------------------------------------------
     loadTab wrapped in useCallback to prevent re-renders
  --------------------------------------------------------- */

  const loadTab = useCallback(async (tab: Tab) => {
    if (tab === "Notes") return "";

    const key = buildKey(tab, language);

    if (localCache.current.has(key)) {
      return localCache.current.get(key)!;
    }

    setErrorMsg("");

    try {
      const enKey = buildKey(tab, "EN");
      let en = localCache.current.get(enKey);

      if (!en) {
        en = await getVerseAnalysis(verseRef, tab, "EN");
        localCache.current.set(enKey, en);
      }
      setOriginalAnalysis((p) => ({ ...p, [tab]: en }));

      if (language === "EN") {
        localCache.current.set(key, en);
        return en;
      }

      const { englishBlock, withoutEnglish } = extractEnglishTranslitBlock(en);
      const sanitized = sanitizeToAsciiOptionB(englishBlock);
      const teluguLine = buildTeluguTranslitFromEnglishBlock(sanitized);

      let working = replaceParentheticalTranslitsWithTelugu(withoutEnglish);

      const isNT = isNewTestament(verseRef.book);
      const origHeading = isNT ? "గ్రీకు వచనం:" : "హీబ్రూ వచనం:";
      const sec1Rx = /(1\.\s*(Hebrew|Greek)\s*Text\s*[:\n]*)([\s\S]*?)(?=\n\s*2\.|\n\s*3\.|$)/i;

      let final = working;

      if (sec1Rx.test(working)) {
        final = working.replace(sec1Rx, (_m, _h, lang, block) => {
          return `1. ${origHeading}\n${block.trim()}\n\n2. తెలుగు లిప్యంతరీకరణ:\n${teluguLine}\n\n`;
        });
      } else {
        final = `2. తెలుగు లిప్యంతరీకరణ:\n${teluguLine}\n\n` + working;
      }

      const translatePrompt = `
Translate to natural Telugu.
Do NOT translate Hebrew/Greek or Telugu transliteration.

Convert headers:
1. Hebrew Text -> ${origHeading}
1. Greek Text -> ${origHeading}
3. Smooth English Translation -> సరళమైన తెలుగు అనువాదం:
4. Word-by-Word Analysis -> పదాల వారీగా విశ్లేషణ:

----BEGIN----
${final}
----END----
`;

      const translated = await flashGenerate(translatePrompt);
      const output = translated?.trim() || final;

      localCache.current.set(key, output);
      return output;
    } catch (err: any) {
      setErrorMsg(language === "TE" ? "కంటెంట్ లోడ్ కాలేదు." : "Failed to load content.");
      return "";
    }
  }, [verseRef, language]);

  /* ---------------------------------------------------------
     RESET on verse change (NO loadTab here)
  --------------------------------------------------------- */
  useEffect(() => {
    localCache.current = new Map();

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
  }, [verseRef]);

  /* ---------------------------------------------------------
     Single unified loader (fixes the double API call problem)
  --------------------------------------------------------- */
  useEffect(() => {
    if (activeTab === "Notes") return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const text = await loadTab(activeTab);
      if (!cancelled) {
        setAnalysis((p) => ({ ...p, [activeTab]: text }));
      }

      setLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [activeTab, language, verseRef, loadTab]);

  /* ---------------------------------------------------------
     Render
  --------------------------------------------------------- */

  const tabs: Tab[] = [
    "Interlinear",
    "Cross-references",
    "Historical Context",
    "Notes",
  ];

  return (
    <div className="p-4 md:p-6 h-full flex flex-col relative">

      {onClose && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 p-2"
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
          <p className="mt-1 text-gray-700 dark:text-gray-300 italic">
            "{englishText}"
          </p>
        </div>

        <div className="flex items-center gap-2 mr-10 md:mr-0">
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Language
          </label>
          <button
            onClick={() => setLanguage((l) => (l === "EN" ? "TE" : "EN"))}
            className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {language}
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="-mb-px flex space-x-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
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
                placeholder={
                  language === "TE"
                    ? "ఈ వచనం పై మీ వ్యక్తిగత గమనికలు..."
                    : "Your personal notes on this verse..."
                }
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
              />
            ) : errorMsg ? (
              <p className="text-red-500">{errorMsg}</p>
            ) : (
              <pre className="whitespace-pre-wrap">
                {analysis[activeTab] ?? ""}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
