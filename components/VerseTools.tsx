// src/components/VerseTools.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { getVerseAnalysis, flashGenerate, isNewTestament } from "../services/geminiService";
import type { Verse, VerseReference } from "../types";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { findBookMetadata, fetchChapter } from "../services/bibleService";
import ModalPortal from "./ModalPortal";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";

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
   Utility Normalizers (CRITICAL)
--------------------------------------------------------- */
function normalizeRef(str: string): string {
  return str
    .replace(/[–—-]/g, "-")        // unify dashes
    .replace(/\u200B|\u200C|\u200D/g, "") // remove invisible chars
    .replace(/\s+/g, " ")          // collapse spaces
    .trim();
}

/* ---------------------------------------------------------
   Transliteration Helpers
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
    [/(ai)/gi, "ై"], [/(au)/gi, "ౌ"],
    [/(e)/g, "ె"], [/(o)/g, "ొ"],
    [/(i)/g, "ి"], [/(u)/g, "ు"],
    [/(a)/g, ""]
  ];

  for (const [rx, repl] of rules) s = s.replace(rx, repl);

  s = s.replace(/\s+/g, " ").trim();

  return s.replace(/(^|\s)[ాీూెొైౌ]/g, (m) =>
    (m.startsWith(" ") ? " అ" : "అ") + m.trim()
  );
}

/* buildTeluguTranslitFromEnglishBlock */
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
  const [previewRef, setPreviewRef] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("Interlinear");
  const [language, setLanguage] = useState<"EN" | "TE">("EN");

  const [analysis, setAnalysis] = useState<Record<Tab, string | null>>({
    Interlinear: null,
    "Cross-references": null,
    "Historical Context": null,
    Notes: null
  });

  const [originalAnalysis, setOriginalAnalysis] = useState<Record<Tab, string | null>>({
    Interlinear: null,
    "Cross-references": null,
    "Historical Context": null,
    Notes: null
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
     Cross-reference Loader (FULL FIXED)
  --------------------------------------------------------- */
  const loadReferenceText = async (refString: string) => {
    try {
      const clean = normalizeRef(
        refString
          .replace(/^[–\-•\s]+/, "")
          .replace(/\(.*?\)/g, "")
      );

      const m = clean.match(
        /^([\u0C00-\u0C7FA-Za-z\. ]+?)\s+(\d+):(\d+)(?:-(\d+))?$/
      );

      if (!m) return "";

      let rawBook = m[1].trim();
      const chapter = Number(m[2]);
      const startVerse = Number(m[3]);
      const endVerse = m[4] ? Number(m[4]) : startVerse;

      let meta = findBookMetadata(rawBook);

      if (!meta) {
        const englishKey = Object.keys(TELUGU_BOOK_NAMES).find(
          (k) => TELUGU_BOOK_NAMES[k] === rawBook
        );
        if (!englishKey) return "";
        meta = findBookMetadata(englishKey);
        if (!meta) return "";
      }

      const chapterData = await fetchChapter(meta.name, chapter);
      if (!chapterData) return "";

      const selected = chapterData.filter(
        (v) => v.verse >= startVerse && v.verse <= endVerse
      );

      if (!selected.length) return "";

      return selected
        .map((v) =>
          language === "TE"
            ? v.text.BSI_TELUGU || v.text.KJV || ""
            : v.text[englishVersion] || v.text.KJV || ""
        )
        .join("\n");
    } catch {
      return "";
    }
  };

  /* ---------------------------------------------------------
     loadTab
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

      const sec1Rx =
        /(1\.\s*(Hebrew|Greek)\s*Text\s*[:\n]*)([\s\S]*?)(?=\n\s*2\.|\n\s*3\.|$)/i;

      let final = working;

      if (sec1Rx.test(working)) {
        final = working.replace(sec1Rx, (_m, _h, _lang, block) => {
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
    } catch {
      setErrorMsg(language === "TE" ? "కంటెంట్ లోడ్ కాలేదు." : "Failed to load content.");
      return "";
    }
  }, [verseRef, language]);

  /* reset on verse change */
  useEffect(() => {
    localCache.current = new Map();

    setAnalysis({
      Interlinear: null,
      "Cross-references": null,
      "Historical Context": null,
      Notes: userNotes
    });

    setOriginalAnalysis({
      Interlinear: null,
      "Cross-references": null,
      "Historical Context": null,
      Notes: userNotes
    });

    setActiveTab("Interlinear");
    setErrorMsg("");
  }, [verseRef]);

  /* tab loader */
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
    "Notes"
  ];

  return (
    <div className="p-4 md:p-6 h-full flex flex-col relative">
      {onClose && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 right-3 text-gray-500 dark:text-gray-400"
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
            className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
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
                  : "border-transparent text-gray-500 dark:text-gray-400"
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
                className="w-full h-64 p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
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
                {(analysis[activeTab] ?? "").split("\n").map((line, idx) => {
                  const ref = line.match(
                    /([\u0C00-\u0C7F A-Za-z\.]+?\s+\d+:\d+(?:[-–]\d+)?)/ // Telugu + English
                  );

                  if (ref) {
                    const reference = ref[1];

                    return (
                      <div key={idx}>
                        {line.replace(reference, `<ref>${reference}</ref>`)
                          .split(/(<ref>|<\/ref>)/g)
                          .map((part, i) => {
                            if (part === "<ref>" || part === "</ref>")
                              return null;

                            if (part === reference) {
                              return (
                                <span
                                  key={i}
                                  className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                  onClick={async () => {
                                    setPreviewRef(reference);
                                    const text =
                                      await loadReferenceText(reference);
                                    setPreviewText(text);
                                    setIsPreviewOpen(true);
                                  }}
                                >
                                  {reference}
                                </span>
                              );
                            }

                            return <span key={i}>{part}</span>;
                          })}
                      </div>
                    );
                  }

                  return <div key={idx}>{line}</div>;
                })}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------
         Popup Preview Modal
      --------------------------------------------------------- */}
      {isPreviewOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setIsPreviewOpen(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg w-11/12 max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2">
                {language === "TE"
                  ? (() => {
                      const match = previewRef?.match(
                        /^([\u0C00-\u0C7FA-Za-z\. ]+)\s+/
                      );
                      if (!match) return previewRef;

                      const raw = match[1].trim();

                      let meta = findBookMetadata(raw);
                      if (!meta) {
                        const englishKey = Object.keys(TELUGU_BOOK_NAMES).find(
                          (k) => TELUGU_BOOK_NAMES[k] === raw
                        );
                        meta = englishKey ? findBookMetadata(englishKey) : null;
                      }

                      const telName =
                        (meta && TELUGU_BOOK_NAMES[meta.name]) || raw;

                      return previewRef?.replace(raw, telName);
                    })()
                  : previewRef}
              </h3>

              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {previewText || "Verse not found."}
              </p>

              <button
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
                onClick={() => setIsPreviewOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
