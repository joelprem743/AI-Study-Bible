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
import { Verse, VerseReference } from "..";
import { findBookMetadata, fetchChapter } from "../services/bibleService";
import ModalPortal from "./ModalPortal";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import { useNotes } from "../context/NotesContext";

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
  "Notes",
  "Cross-references",
  "Historical Context",
  "Interlinear",
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
  const { getNoteFor, refreshNoteFor, saveNoteFor } = useNotes();

  const [previewRef, setPreviewRef] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("Notes");
  const [language, setLanguage] = useState<"EN" | "TE">("EN");

  const [analysis, setAnalysis] = useState<Record<Tab, string | null>>({
    Interlinear: null,
    "Cross-references": null,
    "Historical Context": null,
    Notes: null,
  });

  const [menuOpen, setMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const verseId = `${verseRef.book}-${verseRef.chapter}-${verseRef.verse}`;
  const [noteText, setNoteText] = useState<string>("");

  const localCache = useRef(new Map<string, string>());
  const refCache = useRef(new Map<string, string>());

  const displayVerseText =
    language === "TE"
      ? verseData.text.BSI_TELUGU || verseData.text.KJV
      : verseData.text[englishVersion] || verseData.text.KJV;

  const buildKey = useCallback(
    (tab: Tab, lang: "EN" | "TE") => `${verseId}::${tab}::${lang}`,
    [verseId]
  );

  const handleCopyVerse = () => {
    const bookName =
      language === "TE"
        ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
        : verseRef.book;

    const ref = `${bookName} ${verseRef.chapter}:${verseRef.verse}`;
    const text = displayVerseText || "";

    const out = `${ref} — ${text}`;

    navigator.clipboard.writeText(out).catch((err) => {
      console.error("Copy failed", err);
    });
  };

  const handleShareVerse = async () => {
    const bookName =
      language === "TE"
        ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
        : verseRef.book;

    const ref = `${bookName} ${verseRef.chapter}:${verseRef.verse}`;
    const text = displayVerseText || "";

    const message = `${ref}\n${text}`;

    const shareData = {
      title: "Bible Verse",
      text: message,
      url: `${window.location.origin}/#/${verseRef.book}/${verseRef.chapter}/${verseRef.verse}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        console.error("Native share failed:", err);
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      alert(
        language === "TE"
          ? "వచనం క్లిప్‌బోర్డ్‌కి కాపీ అయింది!"
          : "Verse copied to clipboard!"
      );
    } catch (err) {
      console.error("Clipboard write failed:", err);
    }
  };

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

  /* -------------------------
    loadTab (analysis)
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
        const MODEL_LANG_EN: "EN" = "EN";

        if (language === "EN" || tab === "Interlinear") {
          const enKey = buildKey(tab, MODEL_LANG_EN);
          const cachedEN = localCache.current.get(enKey);

          if (cachedEN != null) {
            en = cachedEN;
          } else {
            const fetched = await getVerseAnalysis(verseRef, tab, MODEL_LANG_EN);
            en = fetched || "";
            localCache.current.set(enKey, en);
          }
        }

        if (language === "EN") {
          const result = en || "";
          localCache.current.set(key, result);
          return result;
        }

        if (language === "TE" && tab !== "Interlinear") {
          const te = (await getVerseAnalysis(verseRef, tab, "TE")) || "";
          localCache.current.set(key, te);
          return te;
        }

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
      } catch (e: any) {
        console.error("loadTab error", e);
        const fallback =
          language === "TE" ? "కంటెంట్ లోడ్ కాలేదు." : "Failed to load content.";
        setErrorMsg(e?.message || fallback);
        return "";
      }
    },
    [verseRef, language, buildKey]
  );

  /* -------------------------
    Effects
  ---------------------------*/
  useEffect(() => {
    localCache.current.clear();
    refCache.current.clear();

    setAnalysis({
      Interlinear: null,
      "Cross-references": null,
      "Historical Context": null,
      Notes: null,
    });

    setErrorMsg("");
    setActiveTab("Notes");
  }, [verseRef]);

  useEffect(() => {
    const existing = getNoteFor(verseRef);
    setNoteText(existing?.content ?? "");
  }, [verseRef, getNoteFor]);

  useEffect(() => {
    if (activeTab === "Notes") return;
    setAnalysis((prev) => ({
      ...prev,
      [activeTab]: null,
    }));
    setErrorMsg("");
  }, [language, activeTab]);

  const handleGenerateClick = useCallback(async () => {
    if (activeTab === "Notes") return;
    setLoading(true);
    setErrorMsg("");

    const text = await loadTab(activeTab);

    setAnalysis((prev) => ({
      ...prev,
      [activeTab]: text,
    }));
    setLoading(false);
  }, [activeTab, loadTab]);

  const handleClickReference = useCallback(
    async (reference: string) => {
      setPreviewRef(reference);
      const text = await loadReferenceText(reference);
      setPreviewText(text);
      setIsPreviewOpen(true);
    },
    [loadReferenceText]
  );

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

  const handleNoteChange = useCallback(
    async (val: string) => {
      setNoteText(val);
      try {
        await saveNoteFor(verseRef, val);
        await refreshNoteFor(verseRef);
      } catch (e) {
        console.error("Failed to save note", e);
      }
    },
    [saveNoteFor, refreshNoteFor, verseRef]
  );

  /* -------------------------
    Render
  ---------------------------*/
  return (
    <div className="p-4 md:p-6 h-full flex flex-col relative">
      {/* HEADER */}
<div className="mb-4">
  <div className="flex items-center justify-between">
    
    {/* Title */}
    <h2 className="text-xl font-bold text-blue-500 dark:text-blue-400">
      {language === "TE"
        ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
        : verseRef.book}{" "}
      {verseRef.chapter}:{verseRef.verse}
    </h2>

    {/* Action buttons */}
    <div className="flex items-center gap-2 relative">

      

      {/* Ellipsis Menu */}
      <div className="flex items-center gap-4">

  {/* Ellipsis Menu */}
  <div className="relative">
    <button
      onClick={() => setMenuOpen((v) => !v)}
      className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 
                 text-gray-600 dark:text-gray-300"
    >
      <i className="fas fa-ellipsis-v" />
    </button>

    {menuOpen && (
      <div
        className="
          absolute right-0 translate-x-[-8px] mt-2 w-44
          bg-white dark:bg-gray-800 
          border border-gray-300 dark:border-gray-600
          rounded-lg shadow-xl z-[9999]"
      >
        <button
          onClick={() => { handleCopyVerse(); setMenuOpen(false); }}
          className="w-full px-4 py-2 flex items-center gap-3 text-left 
                     text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <i className="fas fa-copy w-4" />
          Copy Verse
        </button>

        <button
          onClick={() => { handleShareVerse(); setMenuOpen(false); }}
          className="w-full px-4 py-2 flex items-center gap-3 text-left 
                     text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <i className="fas fa-share w-4" />
          Share Verse
        </button>

        <button
          onClick={() => { setLanguage(language === 'EN' ? 'TE' : 'EN'); setMenuOpen(false); }}
          className="w-full px-4 py-2 flex items-center gap-3 text-left 
                     text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <i className="fas fa-globe w-4" />
          Language: {language}
        </button>
      </div>
    )}
  </div>

  {/* Close button */}
  {onClose && (
    <button
      onClick={onClose}
      className="text-gray-500 dark:text-gray-400 hover:text-gray-300"
    >
      <i className="fas fa-times text-lg" />
    </button>
  )}
</div>

    </div>
  </div>

  {/* Verse Text */}
  <p className="text-gray-200 dark:text-gray-200 italic text-sm mt-2 leading-relaxed">
    {displayVerseText ? `"${displayVerseText}"` : ""}
  </p>
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
              onClick={() => {
                onHighlightChange("yellow");
                onClose?.();
              }}
              className="w-6 h-6 rounded-full border bg-yellow-300"
            />
            <button
              type="button"
              onClick={() => {
                onHighlightChange("green");
                onClose?.();
              }}
              className="w-6 h-6 rounded-full border bg-green-300"
            />
            <button
              type="button"
              onClick={() => {
                onHighlightChange("pink");
                onClose?.();
              }}
              className="w-6 h-6 rounded-full border bg-rose-300"
            />
            <button
              type="button"
              onClick={() => {
                onHighlightChange("blue");
                onClose?.();
              }}
              className="w-6 h-6 rounded-full border bg-sky-300"
            />

            <button
              type="button"
              onClick={() => {
                onHighlightChange(null);
                onClose?.();
              }}
              className="
                px-3 py-1 text-xs rounded 
                border border-gray-300 dark:border-gray-600 
                bg-gray-100 dark:bg-gray-800 
                text-gray-700 dark:text-gray-200 
                hover:bg-gray-200 dark:hover:bg-gray-700
              "
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
              onClick={() => {
                setActiveTab(tab);
                setErrorMsg("");
              }}
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
        {activeTab === "Notes" ? (
          <div className="flex flex-col gap-3">
            <textarea
              className="w-full h-64 p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
              placeholder={
                language === "TE"
                  ? "ఈ వచనం పై మీ వ్యక్తిగత గమనికలు..."
                  : "Your personal notes on this verse..."
              }
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={(e) => void handleNoteChange(e.target.value)}
            />

            <button
              onClick={async () => {
                try {
                  await saveNoteFor(verseRef, noteText);
                  await refreshNoteFor(verseRef);
                  onClose?.();
                } catch (err) {
                  console.error("Failed to save note", err);
                }
              }}
              className="
                self-start px-4 py-2 text-sm 
                bg-blue-600 hover:bg-blue-700 
                text-white rounded-md
              "
            >
              {language === "TE" ? "గమనిక సేవ్ చేయండి" : "Save Note"}
            </button>
          </div>
        ) : loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none font-sans">
            {errorMsg ? (
              <p className="text-red-500 whitespace-pre-wrap">{errorMsg}</p>
            ) : analysis[activeTab] == null ? (
              <div className="flex flex-col items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                <p>
                  {language === "TE"
                    ? "ఈ ట్యాబ్ కోసం AI విశ్లేషణను రూపొందించడానికి క్రింది బటన్‌ను నొక్కండి."
                    : "Click the button below to generate AI analysis for this tab."}
                </p>
                <button
                  onClick={handleGenerateClick}
                  className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  {language === "TE"
                    ? "విశ్లేషణ సృష్టించు"
                    : `Generate ${activeTab}`}
                </button>
              </div>
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