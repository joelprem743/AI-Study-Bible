// src/components/VerseTools.tsx
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getVerseAnalysis,
  flashGenerate,
  isNewTestament,
} from "../services/geminiService";
import type { Verse, VerseReference } from "../types";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { findBookMetadata, fetchChapter } from "../services/bibleService";
import ModalPortal from "./ModalPortal";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";

/* -------------------------
  Small utils / transliteration
---------------------------*/
function normalizeRef(str: string): string {
  return str
    .replace(/[–—-]/g, "-")
    .replace(/\u200B|\u200C|\u200D/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeToAsciiOptionB(input: string): string {
  if (!input) return "";
  const map: [RegExp, string][] = [
    [/ā/g, "aa"],
    [/ē/g, "ee"],
    [/ī/g, "ii"],
    [/ō/g, "oo"],
    [/ū/g, "uu"],
    [/ə/g, "a"],
    [/ʿ|ʾ|ʼ|'|`/g, "'"],
    [/ḥ/g, "h"],
    [/ṭ/g, "t"],
    [/ṣ/g, "s"],
    [/š|ś/g, "sh"],
    [/ḏ/g, "d"],
    [/ṯ/g, "t"],
    [/ḇ/g, "b"],
    [/ẓ/g, "z"],
    [/ā́/g, "aa"],
    [/á|à|â/g, "a"],
    [/ê/g, "e"],
    [/ô/g, "o"],
    [/î/g, "i"],
    [/û/g, "u"],
    [/\p{M}/gu, ""],
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
    [/(chh)/gi, "ఛ్‍"],
    [/(kh)/gi, "ఖ"],
    [/(gh)/gi, "ఘ"],
    [/(ph)/gi, "ఫ"],
    [/(th)/gi, "థ"],
    [/(dh)/gi, "ధ"],
    [/(sh)/gi, "ష"],
    [/(ch)/gi, "చ"],
    [/(ts)/gi, "త్స"],
    [/(ng)/gi, "ంగ"],
    [/(ny)/gi, "న్య"],
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
    [/(aa)/gi, "ా"],
    [/(ii)/gi, "ీ"],
    [/(uu)/gi, "ూ"],
    [/(ai)/gi, "ై"],
    [/(au)/gi, "ౌ"],
    [/(e)/g, "ె"],
    [/(o)/g, "ొ"],
    [/(i)/g, "ి"],
    [/(u)/g, "ు"],
    [/(a)/g, ""],
  ];
  for (const [rx, repl] of rules) s = s.replace(rx, repl);
  s = s.replace(/\s+/g, " ").trim();
  return s.replace(/(^|\s)[ాీూెొైౌ]/g, (m) =>
    m.startsWith(" ") ? " అ" + m.trim() : "అ" + m.trim()
  );
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

function replaceParentheticalTranslitsWithTelugu(aiText: string) {
  return aiText.replace(/\(([A-Za-z0-9'\- ]+)\)/g, (_match, p1) => {
    const cleaned = sanitizeToAsciiOptionB(p1.trim());
    const conv = transliterateLatinToTelugu(cleaned);
    return `(${conv || p1})`;
  });
}

// Split Gemini "1.,2.,3.,4." structure into sections
function splitSections(txt: string) {
  const lines = txt.split("\n");

  const s1: string[] = [];
  const s2: string[] = [];
  const s3: string[] = [];
  const s4: string[] = [];

  let cur = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\*{0,2}1\.\s*/.test(trimmed)) {
      cur = 1;
      continue;
    }
    if (/^\*{0,2}2\.\s*/.test(trimmed)) {
      cur = 2;
      continue;
    }
    if (/^\*{0,2}3\.\s*/.test(trimmed)) {
      cur = 3;
      continue;
    }
    if (/^\*{0,2}4\.\s*/.test(trimmed)) {
      cur = 4;
      continue;
    }

    if (cur === 1) s1.push(line);
    else if (cur === 2) s2.push(line);
    else if (cur === 3) s3.push(line);
    else if (cur === 4) s4.push(line);
  }

  return {
    sec1: s1.join("\n").trim(),
    sec2: s2.join("\n").trim(),
    sec3: s3.join("\n").trim(),
    sec4: s4.join("\n").trim(),
  };
}

/* -------------------------
  Types & small UI bits
---------------------------*/
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full" />
    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6" />
  </div>
);

type Tab = "Interlinear" | "Cross-references" | "Historical Context" | "Notes";

const TABS: Tab[] = [
  "Historical Context",
  "Cross-references",
  "Interlinear",
  "Notes",
];

/* -------------------------
  Inline reference regex
---------------------------*/
const INLINE_REF_REGEX =
  /((?:[1-3]\s*)?(?:[A-Za-z\u0C00-\u0C7F\.']+)\s+\d+:\d+(?:-\d+)?)/gu;

/* -------------------------
  Component
---------------------------*/
export const VerseTools: React.FC<{
  verseRef: VerseReference;
  verseData: Verse;
  englishVersion: string;
  onClose?: () => void;
  currentHighlight?: string;
  onHighlightChange?: (color: string | null) => void;
}> = ({
  verseRef,
  verseData,
  englishVersion,
  onClose,
  currentHighlight,
  onHighlightChange,
}) => {

  const [previewRef, setPreviewRef] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("Historical Context");
  const [language, setLanguage] = useState<"EN" | "TE">("EN");

  const [analysis, setAnalysis] = useState<Record<Tab, string | null>>({
    Interlinear: null,
    "Cross-references": null,
    "Historical Context": null,
    Notes: null,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const verseId = `${verseRef.book}-${verseRef.chapter}-${verseRef.verse}`;
  const [userNotes, setUserNotes] = useLocalStorage<string>(
    `${verseId}-notes`,
    ""
  );

  const localCache = useRef(new Map<string, string>());
  const refCache = useRef(new Map<string, string>());

  const displayVerseText =
    language === "TE"
      ? verseData.text.BSI_TELUGU || verseData.text.KJV
      : verseData.text[englishVersion] || verseData.text.KJV;

  const buildKey = (tab: Tab, lang: "EN" | "TE") =>
    `${verseId}::${tab}::${lang}`;

  /* -------------------------
    loadReferenceText
  ---------------------------*/
  const loadReferenceText = useCallback(
    async (refStringRaw: string) => {
      try {
        const refString = normalizeRef(
          refStringRaw.replace(/^[–\-•\s]+/, "").replace(/\(.*?\)/g, "")
        );

        const cacheKey = `${refString}::${language}`;
        if (refCache.current.has(cacheKey)) {
          return refCache.current.get(cacheKey) || "";
        }

        const m = refString.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/u);
        if (!m) return "";

        const rawBook = m[1].trim();
        const chapter = Number(m[2]);
        const startVerse = Number(m[3]);
        const endVerse = m[4] ? Number(m[4]) : startVerse;

        let meta = findBookMetadata(rawBook);

        if (!meta) {
          const numMatch = rawBook.match(/^([1-3])\s*(.+)$/u);
          if (numMatch) {
            const bookNum = numMatch[1];
            const teluguPart = numMatch[2].trim();
            const englishKey = Object.entries(TELUGU_BOOK_NAMES).find(
              ([eng, tel]) => {
                const telNoNum = tel.replace(/^[1-3]\s*/, "").trim();
                return eng.startsWith(bookNum) && telNoNum === teluguPart;
              }
            );
            if (englishKey) meta = findBookMetadata(englishKey[0]);
          }
        }

        if (!meta) {
          const englishKey = Object.entries(TELUGU_BOOK_NAMES).find(
            ([, tel]) => {
              const telNoNum = tel.replace(/^[1-3]\s*/, "").trim();
              return tel === rawBook || telNoNum === rawBook;
            }
          );
          if (englishKey) meta = findBookMetadata(englishKey[0]);
        }

        if (!meta) {
          meta = findBookMetadata(rawBook);
        }

        if (!meta) return "";

        const chapterData = await fetchChapter(meta.name, chapter);
        if (!chapterData || !chapterData.length) return "";

        const selected = chapterData.filter(
          (v) => v.verse >= startVerse && v.verse <= endVerse
        );
        if (!selected.length) return "";

        const out = selected
          .map((v) =>
            language === "TE"
              ? v.text.BSI_TELUGU || v.text.KJV || ""
              : v.text[englishVersion] || v.text.KJV || ""
          )
          .join("\n");

        refCache.current.set(cacheKey, out);
        return out;
      } catch (err) {
        console.error("loadReferenceText error", err);
        return "";
      }
    },
    [language, englishVersion]
  );
  // Make loadTab stable to avoid unnecessary reloads


  /* -------------------------
    loadTab (analysis) with optimized EN/TE behavior
  ---------------------------*/
  const loadTab = useCallback(
    async (tab: Tab) => {
      if (tab === "Notes") return "";

      const key = buildKey(tab, language);
      const cached = localCache.current.get(key);
      if (cached != null) return cached;

      setErrorMsg("");

      try {
        let en: string | null = null;

        // Fetch English only when needed:
        // - language === "EN" (any tab)
        // - Interlinear tab (for TE pipeline)
        if (language === "EN" || tab === "Interlinear") {
          const enKey = buildKey(tab, "EN");
          const cachedEN = localCache.current.get(enKey);

          if (cachedEN != null) {
            en = cachedEN;
          } else {
            const fetched = await getVerseAnalysis(verseRef, tab, "EN");
            en = fetched || "";
            localCache.current.set(enKey, en);
          }
        }

        // Case 1: English (all tabs, including Interlinear) -> just return EN
        if (language === "EN") {
          const result = en || "";
          localCache.current.set(key, result);
          return result;
        }

        // Case 2: Telugu simple tabs (NO EN NEEDED)
        if (language === "TE" && tab !== "Interlinear") {
          const te = (await getVerseAnalysis(verseRef, tab, "TE")) || "";
          localCache.current.set(key, te);
          return te;
        }

        // Case 3: Telugu Interlinear -> special pipeline
        const original = (en || "").replace(/\r\n/g, "\n");
        const { sec1, sec2, sec3, sec4 } = splitSections(original);

        const alreadyTelugu = /[\u0C00-\u0C7F]/.test(sec2);
        let finalSec2 = sec2;

        if (!alreadyTelugu) {
          const sanitized = sanitizeToAsciiOptionB(sec2);
          finalSec2 = buildTeluguTranslitFromEnglishBlock(sanitized);
        }

        const isNT = isNewTestament(verseRef.book);

        let reconstructed = [
          `**1. ${isNT ? "గ్రీకు వచనం" : "హీబ్రూ వచనం"}:**`,
          sec1,
          "",
          "---",
          "",
          "**2. తెలుగు లిప్యంతరీకరణ:**",
          finalSec2,
          "",
          "---",
          "",
          "**3. సరళమైన తెలుగు అనువాదం:**",
          sec3,
          "",
          "---",
          "",
          "**4. పదాల వారీగా విశ్లేషణ:**",
          sec4,
        ].join("\n");

        reconstructed = replaceParentheticalTranslitsWithTelugu(reconstructed);

        const translPrompt = `
Translate to natural Telugu.
Preserve markdown. Do NOT translate Greek/Hebrew or transliteration.
----BEGIN----
${reconstructed}
----END----
`;

        const out = await flashGenerate(translPrompt);
        const output = (out || reconstructed).trim();

        localCache.current.set(key, output);
        return output;
      } catch (e) {
        console.error("loadTab error", e);
        setErrorMsg(
          language === "TE" ? "కంటెంట్ లోడ్ కాలేదు." : "Failed to load content."
        );
        return "";
      }
    },
    [verseRef.book, verseRef.chapter, verseRef.verse, language, englishVersion]

  );  


  /* -------------------------
    Reset when verse changes
  ---------------------------*/
  useEffect(() => {
    localCache.current.clear();
    refCache.current.clear();

    setAnalysis({
      Interlinear: null,
      "Cross-references": null,
      "Historical Context": null,
      Notes: userNotes,
    });

    setErrorMsg("");
    setActiveTab("Historical Context");
  }, [verseRef, userNotes]);

  /* -------------------------
    Invalidate cache when language changes (current tab only)
  ---------------------------*/
  // Replace your entire language-change effect with:
  useEffect(() => {
    // mark tab as needing reload BEFORE clearing cache
    setAnalysis(prev => ({ ...prev, [activeTab]: null }));
  
    // clear EN + TE cached values for this tab
    localCache.current.delete(`${verseId}::${activeTab}::EN`);
    localCache.current.delete(`${verseId}::${activeTab}::TE`);
  }, [language, activeTab, verseId]);
  
  
  

  

  /* -------------------------
    Load when language/tab changes
  ---------------------------*/
  // Load content when activeTab or language changes
// Load analysis content based on tab + language
useEffect(() => {
  if (activeTab === "Notes") return;

  // Already loaded? Skip.
  if (analysis[activeTab] != null) return;

  let cancelled = false;

  (async () => {
    setLoading(true);
    setErrorMsg("");

    const text = await loadTab(activeTab);

    if (!cancelled) {
      setAnalysis(prev => ({ ...prev, [activeTab]: text }));
      setLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [activeTab, verseId, language, loadTab, analysis]);




  
  /* -------------------------
    Reference click
  ---------------------------*/
  const handleClickReference = useCallback(
    async (reference: string) => {
      setPreviewRef(reference);
      const text = await loadReferenceText(reference);
      setPreviewText(text);
      setIsPreviewOpen(true);
    },
    [loadReferenceText]
  );

  /* -------------------------
    Markdown node rendering with clickable refs
  ---------------------------*/
  const renderNodeWithRefs = useCallback(
    (node: React.ReactNode): React.ReactNode => {
      if (node == null) return null;

      if (typeof node === "string") {
        const parts: React.ReactNode[] = [];
        INLINE_REF_REGEX.lastIndex = 0;
        let lastIndex = 0;
        let m: RegExpExecArray | null;

        while ((m = INLINE_REF_REGEX.exec(node)) !== null) {
          const match = m[1];
          const start = m.index;

          if (start > lastIndex) {
            parts.push(node.substring(lastIndex, start));
          }

          parts.push(
            <span
              key={parts.length + "-" + start}
              className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
              onClick={() => void handleClickReference(match)}
            >
              {match}
            </span>
          );

          lastIndex = start + match.length;
        }

        if (lastIndex < node.length) {
          parts.push(node.substring(lastIndex));
        }

        return parts.length === 0 ? node : parts;
      }

      if (Array.isArray(node)) {
        return node.map((child, i) => (
          <React.Fragment key={i}>{renderNodeWithRefs(child)}</React.Fragment>
        ));
      }

      return node;
    },
    [handleClickReference]
  );

  /* -------------------------
    Preview modal TE ref label
  ---------------------------*/
  const displayPreviewRef = useMemo(() => {
    if (!previewRef) return previewRef;
    if (language !== "TE") return previewRef;

    const match = previewRef.match(/^([\u0C00-\u0C7FA-Za-z\. ]+)\s+/);
    if (!match) return previewRef;

    const raw = match[1].trim();
    let meta = findBookMetadata(raw);

    if (!meta) {
      const englishKey = Object.keys(TELUGU_BOOK_NAMES).find(
        (k) => TELUGU_BOOK_NAMES[k] === raw
      );
      meta = englishKey ? findBookMetadata(englishKey) : null;
    }

    const telName = (meta && TELUGU_BOOK_NAMES[meta.name]) || raw;
    return previewRef.replace(raw, telName);
  }, [previewRef, language]);

  /* -------------------------
    Render
  ---------------------------*/
  return (
    <div className="p-4 md:p-6 h-full flex flex-col relative">
      {onClose && (
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 right-3 text-gray-500 dark:text-gray-400"
        >
          <i className="fas fa-times text-2xl" />
        </button>
      )}
  
      {/* Header: Verse + Language Toggle */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {language === "TE"
              ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
              : verseRef.book}{" "}
            {verseRef.chapter}:{verseRef.verse}
          </h2>
  
          <p className="mt-1 text-gray-700 dark:text-gray-300 italic">
            "{displayVerseText}"
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
  
      {/* Highlight controls */}
      {onHighlightChange && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Highlight
          </span>
  
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onHighlightChange("yellow")}
              className={`
                w-6 h-6 rounded-full border bg-yellow-300
                ${currentHighlight === "yellow" ? "ring-2 ring-white/70 dark:ring-white/60" : ""}
              `}
            />
  
            <button
              type="button"
              onClick={() => onHighlightChange("green")}
              className={`
                w-6 h-6 rounded-full border bg-green-300
                ${currentHighlight === "green" ? "ring-2 ring-white/70 dark:ring-white/60" : ""}
              `}
            />
  
            <button
              type="button"
              onClick={() => onHighlightChange("pink")}
              className={`
                w-6 h-6 rounded-full border bg-rose-300
                ${currentHighlight === "pink" ? "ring-2 ring-white/70 dark:ring-white/60" : ""}
              `}
            />
  
            <button
              type="button"
              onClick={() => onHighlightChange("blue")}
              className={`
                w-6 h-6 rounded-full border bg-sky-300
                ${currentHighlight === "blue" ? "ring-2 ring-white/70 dark:ring-white/60" : ""}
              `}
            />
  
            <button
              type="button"
              onClick={() => onHighlightChange(null)}
              className="ml-2 px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800"
            >
              Clear
            </button>
          </div>
        </div>
      )}
  

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="-mb-px flex space-x-4 overflow-x-auto">
          {TABS.map((tab) => (
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
                  ? "పదాల వారీ అనువాదం"
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

      {/* Main content */}
      <div className="flex-grow overflow-y-auto pr-2">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none font-sans">
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children, ...props }) => (
                    <p
                      {...props}
                      className={`whitespace-pre-wrap mb-3 ${
                        props.className ?? ""
                      }`.trim()}
                    >
                      {renderNodeWithRefs(children)}
                    </p>
                  ),
                  div: ({ children, ...props }) => (
                    <div
                      {...props}
                      className={`whitespace-pre-wrap ${
                        props.className ?? ""
                      }`.trim()}
                    >
                      {renderNodeWithRefs(children)}
                    </div>
                  ),
                  li: ({ children, ...props }) => (
                    <li {...props}>{renderNodeWithRefs(children)}</li>
                  ),
                  strong: ({ children, ...props }) => (
                    <strong {...props}>{renderNodeWithRefs(children)}</strong>
                  ),
                  em: ({ children, ...props }) => (
                    <em {...props}>{renderNodeWithRefs(children)}</em>
                  ),
                  h1: ({ children, ...props }) => (
                    <h1
                      className={`text-2xl font-bold mt-4 ${
                        props.className ?? ""
                      }`.trim()}
                      {...props}
                    >
                      {renderNodeWithRefs(children)}
                    </h1>
                  ),
                  h2: ({ children, ...props }) => (
                    <h2
                      className={`text-xl font-semibold mt-3 ${
                        props.className ?? ""
                      }`.trim()}
                      {...props}
                    >
                      {renderNodeWithRefs(children)}
                    </h2>
                  ),
                  h3: ({ children, ...props }) => (
                    <h3
                      className={`text-lg font-medium mt-2 ${
                        props.className ?? ""
                      }`.trim()}
                      {...props}
                    >
                      {renderNodeWithRefs(children)}
                    </h3>
                  ),
                  hr: (props) => (
                    <hr
                      className={`my-4 border-gray-200 dark:border-gray-700 ${
                        props.className ?? ""
                      }`.trim()}
                      {...props}
                    />
                  ),
                }}
              >
                {analysis[activeTab] ?? ""}
              </ReactMarkdown>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setIsPreviewOpen(false)}
          >
            <div
              className="
                bg-white dark:bg-gray-800 
                p-4 rounded-lg shadow-lg 
                w-11/12 max-w-md 
                max-h-[75vh] 
                overflow-y-auto 
                overscroll-contain
              "
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2">{displayPreviewRef}</h3>

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

export default VerseTools;
