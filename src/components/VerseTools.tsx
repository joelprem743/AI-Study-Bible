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
  isNewTestament,
} from "../services/geminiService";
import { Verse, VerseReference } from "..";
import { findBookMetadata, fetchChapter } from "../services/bibleService";
import ModalPortal from "./ModalPortal";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import { useNotes } from "../context/NotesContext";
import { generateVerseImage } from "../utils/verseImage";
import { sendMessageToLlama } from "../services/geminiService";
import { fetchNTInterlinear } from "../lib/interlinearService";
import {
  fetchOTInterlinear,
  fetchStrongLexicon,
} from "../lib/interlinearServiceOT";
import {
  getVerseAnalysis,
  flashGenerate,
} from "../services/geminiService";


/* -------------------------
  Small utils / transliteration
---------------------------*/
function cleanHebrewSurface(surface: string): string {
  if (!surface) return "";

  return surface
    // remove morphology separators (/ .)
    .replace(/[./]/g, "")
    // remove cantillation marks ONLY (keep vowels)
    .replace(/[\u0591-\u05AF]/g, "")
    // normalize maqaf (Hebrew hyphen)
    .replace(/\s*-\s*/g, "־")
    // collapse accidental whitespace
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeInterlinearRow(r: any, isNT: boolean) {
  if (isNT) {
    const parts = extractInterlinearParts(r.definition);
    return {
      wordIndex: r.word_index,
      surface: r.surface,
      lemma: parts.lemmaGreek,
      transliteration: parts.transliteration,
      meaning: parts.meaning,
      strong: r.strong,
      definition: r.definition, // ✅ KEEP THIS
    };
  }

  // OT unchanged
  // OT — defer meaning to strongCache (correct)
  return {
    wordIndex: r.word_index,
    surface: r.surface,
    lemma: "",              // OT comes from strongCache
    transliteration: "",    // OT comes from strongCache
    meaning: "",            // OT comes from strongCache
    strong: r.strong,
  };
  

  
}


function renderHebrewTextInteractive(
  rows: any[],
  onHover: (idx: number) => void,
  onClick: (idx: number) => void
) {
  return rows
  .slice()
  .sort((a, b) => (a.word_index ?? 0) - (b.word_index ?? 0))
  .map((r, i) => {
    const idx = r.word_index ?? i;

    return (
      <span
        key={`ot-${i}`}   // ✅ UNIQUE, STABLE FOR OT
        dir="rtl"
        className="
          cursor-pointer
          hover:bg-yellow-200
          dark:hover:bg-yellow-600
          px-0.5
          rounded
          inline-block
        "
        onMouseEnter={() => onHover(idx)}
        onClick={() => onClick(idx)}
      >
        {cleanHebrewSurface(r.surface)}{" "}
      </span>
    );
  });
}


function renderOriginalTextInteractive(
  rows: any[],
  onHover: (idx: number) => void,
  onClick: (idx: number) => void
) {
  return rows
    .slice()
    .sort((a, b) => (a.word_index ?? 0) - (b.word_index ?? 0))
    .map((r, i) => {
      const idx = r.word_index ?? i;

      return (
        <span
          key={idx}
          className="
            cursor-pointer
            hover:bg-yellow-200
            dark:hover:bg-yellow-600
            px-0.5
            rounded
          "
          onMouseEnter={() => onHover(idx)}
          onClick={() => onClick(idx)}
        >
          {r.surface}{" "}
        </span>
      );
    });
}



function buildGreekVerse(rows: any[]): string {
  if (!rows || rows.length === 0) return "";

  return rows
    .slice()
    .sort((a, b) => a.word_index - b.word_index)
    .map(r => r.surface)
    .join(" ");
}

function buildTransliterationVerse(rows: any[]): string {
  if (!rows || rows.length === 0) return "";

  return rows
    .slice()
    .sort((a, b) => a.word_index - b.word_index)
    .map(r => {
      // Prefer explicit transliteration field
      if (r.transliteration) return r.transliteration;

      // Fallback: extract from definition
      const parts = extractInterlinearParts(r.definition);
      return parts.transliteration || "";
    })
    .filter(Boolean)
    .join(" ");
}

function extractInterlinearParts(def?: string): {
  transliteration: string;
  meaning: string;
  lemmaGreek: string;
} {
  if (!def) {
    return { transliteration: "", meaning: "", lemmaGreek: "" };
  }

  // Clean junk first
  const cleaned = cleanDefinition(def);

  /**
   * Example cleaned:
   * "εἰς eis toward εἰς, prep"
   */

  // 1️⃣ Extract first Greek (lemma)
  const greekMatches = cleaned.match(
    /[\u0370-\u03FF\u1F00-\u1FFF]+/g
  );

  const lemmaGreek = greekMatches?.[greekMatches.length - 1] ?? "";

  // 2️⃣ Extract transliteration + gloss
  const glossMatch = cleaned.match(
    /^[\u0370-\u03FF\u1F00-\u1FFF]+\s+([a-zA-Zōēáéíóú]+)\s+([^,.;]+)/i
  );

  let transliteration = "";
  let meaning = "";

  if (glossMatch) {
    transliteration = glossMatch[1].trim();
    meaning = glossMatch[2].trim();
  }

  // 3️⃣ Remove any Greek from meaning
  meaning = meaning.replace(
    /[\u0370-\u03FF\u1F00-\u1FFF]+/g,
    ""
  ).trim();

  return {
    transliteration,
    meaning,
    lemmaGreek,
  };
}


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

function cleanDefinition(raw?: string) {
  if (!raw) return "";

  return raw
    // remove refs like (WH, Thayer, etc.)
    .replace(/\([^)]*\b(?:WH|Thayer|WM|Gr|Pr|Bl|App)\b[^)]*\)/gi, "")
    // remove __I. __1. style markers
    .replace(/__+/g, "")
    // remove Greek grammar codes like G:T, G:COND
    .replace(/\bG:[A-Z]+\b/g, "")
    // strip HTML
    .replace(/<[^>]+>/g, "")
    // normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

type FormattedLexicon = {
  transliteration: string;
  coreMeaning: string;
  sections: {
    title: string;
    bullets: string[];
  }[];
};



function formatGreekLexicon(def: string): FormattedLexicon {
  const cleaned = cleanDefinition(def);

  // 1️⃣ Extract transliteration (Greek + Latin pair)
  // Example: εἰμί eimi
  const translitMatch = cleaned.match(
    /([\u0370-\u03FF\u1F00-\u1FFF]+)\s+([A-Za-z]+)/ 
  );

  const transliteration = translitMatch?.[2] ?? "";

  // 2️⃣ Extract core meaning
  // Take first short English gloss after transliteration
  let coreMeaning = "";

  if (translitMatch) {
    const after = cleaned.slice(translitMatch.index! + translitMatch[0].length);
    const meaningMatch = after.match(
      /\b(to\s+[a-z][^.;:,]*)|\b([a-z][^.;:,]{3,40})/i
    );
    coreMeaning = meaningMatch?.[0]?.trim() ?? "";
  }

  // 3️⃣ Split sections (Roman numerals)
  const sections: FormattedLexicon["sections"] = [];

  const parts = cleaned.split(/\bI\.|\bII\./);

  if (parts[1]) {
    sections.push({
      title: "Substantive verb",
      bullets: parts[1]
        .split(/\d\./)
        .map(s => s.trim())
        .filter(s => s.length > 20),
    });
  }

  if (parts[2]) {
    sections.push({
      title: "Copula / linking verb",
      bullets: parts[2]
        .split(/\d\./)
        .map(s => s.trim())
        .filter(s => s.length > 20),
    });
  }

  return {
    transliteration,
    coreMeaning,
    sections,
  };
}



function extractCoreMeaning(def: string): string {
  if (!def) return "";

  // Take first meaningful sentence / clause
  const stopChars = [".", ";", ":"];
  let cutIndex = def.length;

  for (const ch of stopChars) {
    const idx = def.indexOf(ch);
    if (idx !== -1 && idx < cutIndex) cutIndex = idx;
  }

  return def.slice(0, cutIndex).trim();
}

function isProperNameEntry(def: string): boolean {
  return /\bN:N-|N\s*:\s*N\b|\bpersonal name\b/i.test(def);
}

function summarizeProperName(def: string): string {
  // Normalize
  const text = def.replace(/\s+/g, " ");

  // Extract the English name (John, Paul, etc.)
  const nameMatch = text.match(/\b([A-Z][a-z]+)\b/);
  const name = nameMatch ? nameMatch[1] : "Proper name";

  const roles: string[] = [];

  if (/Baptist/i.test(text)) roles.push("John the Baptist");
  if (/Apostle|son of Zebedee/i.test(text))
    roles.push("John the Apostle (son of Zebedee)");
  if (/Mark/i.test(text)) roles.push("John Mark");
  if (/Apocalypse|Revelation/i.test(text))
    roles.push("Author associated with Revelation");

  if (roles.length === 0) {
    return `${name} (personal name used for multiple individuals in the New Testament)`;
  }

  return `${name} (personal name), referring to:\n• ${roles.join("\n• ")}`;
}


function replaceParentheticalTranslitsWithTelugu(aiText: string) {
  return aiText.replace(/\(([A-Za-z0-9'\- ]+)\)/g, (_match, p1) => {
    const cleaned = sanitizeToAsciiOptionB(p1.trim());
    const conv = transliterateLatinToTelugu(cleaned);
    return `(${conv || p1})`;
  });
}
function scrollCardIntoView(el: HTMLElement, offset: number) {
  const y =
    el.getBoundingClientRect().top +
    window.scrollY -
    offset -
    8;

  window.scrollTo({
    top: y,
    behavior: "smooth",
  });
}


function isValidBibleRef(ref: string) {
  return /^((?:[1-3]\s*)?[A-Za-z\u0C00-\u0C7F\.']+)\s+\d+:\d+(?:-\d+)?$/.test(ref);
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

type Tab = "Interlinear" | "Summary"| "Cross-references" | "Historical Context" | "Notes";

const PRIMARY_TABS: Tab[] = ["Summary", "Notes"];

const ADVANCED_TABS: Tab[] = [
  "Interlinear",
  "Cross-references",
  "Historical Context",
];


/* -------------------------
  Inline reference regex
---------------------------*/
const BOOK_NAME_PATTERN = (() => {
  const englishBooks = Object.keys(TELUGU_BOOK_NAMES);

  const teluguBooks = Object.values(TELUGU_BOOK_NAMES);

  const allBooks = [...englishBooks, ...teluguBooks]
    .map(b => b.replace(/\./g, "\\."))
    .sort((a, b) => b.length - a.length); // longest first

  return allBooks.join("|");
})();

const GREEK_WORD_REGEX = /([\u0370-\u03FF\u1F00-\u1FFF]+)/g;

const INLINE_REF_RENDER_REGEX = new RegExp(
  `\\b((?:${BOOK_NAME_PATTERN})\\s+\\d+:\\d+(?:-\\d+)?)\\b`,
  "u"
);



const STRONG_REF_REGEX =
  /\b(?:Mat|Mrk|Luk|Jhn|Act|Rom|Cor|Gal|Eph|Php|Col|Th|Tim|Tit|Phm|Heb|Jam|Pet|Jde|Rev)\.?\s*\d+:\d+(?:-\d+)?/g;

  const STRONG_BOOK_MAP: Record<string, string> = {
    "Mat": "Matthew",
    "Mrk": "Mark",
    "Mar": "Mark",
    "Luk": "Luke",
    "Jhn": "John",
    "Joh": "John",
    "Act": "Acts",
    "Rom": "Romans",
    "1Cor": "1 Corinthians",
    "2Cor": "2 Corinthians",
    "Gal": "Galatians",
    "Eph": "Ephesians",
    "Php": "Philippians",
    "Col": "Colossians",
    "1Th": "1 Thessalonians",
    "2Th": "2 Thessalonians",
    "1Tim": "1 Timothy",
    "2Tim": "2 Timothy",
    "Tit": "Titus",
    "Phm": "Philemon",
    "Heb": "Hebrews",
    "Jam": "James",
    "1Pet": "1 Peter",
    "2Pet": "2 Peter",
    "Jde": "Jude",
    "Rev": "Revelation",
  };
  
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
  const isTeluguVersion = (version?: string) =>
    version === "BSI_TELUGU" || version?.toLowerCase().includes("telugu");
  
  const [previewRef, setPreviewRef] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("Summary");
  const [language, setLanguage] = useState<"EN" | "TE">("EN");
  const [originalVerse, setOriginalVerse] = useState<string>("");
  const [translitVerse, setTranslitVerse] = useState<string>("");


  const [analysis, setAnalysis] = useState<Record<Tab, string | null>>({
    Interlinear: null,
    Summary: null,
    "Cross-references": null,
    "Historical Context": null,
    Notes: null,
  });


  

  type StrongPopupData = {
    strong: string;
    lemma: string;
    lexicon: {
      transliteration?: string;
      coreMeaning?: string;
      sections: {
        title: string;
        bullets: string[];
      }[];
    };
  };
  
  
  
  
  const [strongPopup, setStrongPopup] = useState<StrongPopupData | null>(null);
  const [showFullLexicon, setShowFullLexicon] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const wordRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const originalBlockRef = useRef<HTMLDivElement | null>(null);
  const [stickyHeight, setStickyHeight] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);


  
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const verseId = `${verseRef.book}-${verseRef.chapter}-${verseRef.verse}`;
  const [noteText, setNoteText] = useState<string>("");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({} as Record<Tab, HTMLButtonElement | null>);



  const localCache = useRef(new Map<string, string>());
  const refCache = useRef(new Map<string, string>());
  const [interlinearRows, setInterlinearRows] = useState<any[]>([]);
  const [strongCache, setStrongCache] = useState<
  Record<
    string,
    {
      lemma: string;
      transliteration: string;
      meaning: string;
      definition?: string;
    }
  >
>({});


async function preloadStrongLexicons(rows: any[]) {
  const strongs = Array.from(
    new Set(rows.map(r => r.strong).filter(Boolean))
  );

  const missing = strongs.filter(s => !strongCache[s]);
  if (missing.length === 0) return;

  const entries: Record<string, any> = {};

  await Promise.all(
    missing.map(async (strong) => {
      const lex = await fetchStrongLexicon(strong);
      if (lex) {
        entries[strong] = {
          lemma: lex.hebrew || "",              // ← Hebrew IS the lemma
          transliteration: lex.transliteration || "",
          meaning: lex.gloss || "",
          definition: lex.meaning || "",
        };
        
      }
    })
  );

  if (Object.keys(entries).length > 0) {
    setStrongCache(prev => ({ ...prev, ...entries }));
  }
}

  const displayVerseText =
    language === "TE"
      ? verseData.text.BSI_TELUGU || verseData.text.KJV
      : verseData.text[englishVersion] || verseData.text.KJV;

  const buildKey = useCallback(
    (tab: Tab, lang: "EN" | "TE") => `${verseId}::${tab}::${lang}`,
    [verseId]
  );
  // Hover: highlight ONLY (no scroll)
const handleWordHover = (idx: number) => {
  setActiveWordIndex(idx);
};

// Click: highlight + scroll
const handleWordClick = (idx: number) => {
  setActiveWordIndex(idx);

  const el = wordRefs.current.get(idx);
  if (el) {
    scrollCardIntoView(el, stickyHeight);
  }
  
};



  const handleWordSelect = (idx: number) => {
    setActiveWordIndex(idx);
  
    const el = wordRefs.current.get(idx);
    if (el) {
      scrollCardIntoView(el, stickyHeight);
    }
    
  };

  
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
    // ALWAYS fetch correct verse fresh (fixes stale/wrong verse bug)
    const chapterData = await fetchChapter(verseRef.book, verseRef.chapter);
    const actual = chapterData.find(v => v.verse === verseRef.verse);
  
    const correctText =
      language === "TE"
        ? actual?.text.BSI_TELUGU || actual?.text.KJV || ""
        : actual?.text[englishVersion] || actual?.text.KJV || "";
  
    const bookName =
      language === "TE"
        ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
        : verseRef.book;
  
    const ref = `${bookName} ${verseRef.chapter}:${verseRef.verse}`;
  
    const message = `${ref}\n${correctText}\n\n${window.location.origin}/#/${verseRef.book}/${verseRef.chapter}/${verseRef.verse}`;
  
    const shareData = {
      title: "Bible Verse",
      text: message
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

  const handleShareAsImage = async () => {
    try {
      const blob = await generateVerseImage(
        verseRef,
        displayVerseText,
        language
      );
  
      const file = new File([blob], "verse.png", { type: "image/png" });
  
      const bookName =
        language === "TE"
          ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
          : verseRef.book;
  
      const refText = `${bookName} ${verseRef.chapter}:${verseRef.verse}`;
  
      const verseUrl = `${window.location.origin}/#/${verseRef.book}/${verseRef.chapter}/${verseRef.verse}`;
  
      // 🔑 THIS is what YouVersion does
      const shareText = `${refText}\n\n${verseUrl}`;
  
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Bible Verse",
          text: shareText,   // ✅ URL OUTSIDE the image
          files: [file],     // ✅ Image
        });
        return;
      }
  
      // ---------- Fallback ----------
      // Download image
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "verse.png";
      a.click();
      URL.revokeObjectURL(url);
  
      // Copy verse + URL
      await navigator.clipboard.writeText(shareText);
  
      alert(
        language === "TE"
          ? "చిత్రం షేర్ అయింది. లింక్ ఆటోమేటిక్‌గా కాపీ అయింది — క్యాప్షన్‌లో పేస్ట్ చేయండి."
          : "Image shared. Link copied — paste it in the caption."
      );
      
    } catch (err) {
      console.error("Image share failed", err);
    }
  };
  
  
  function normalizeStrongRef(ref: string): string {
    // Mat.3:1 → Mat 3:1
    const cleaned = ref.replace(".", " ");
  
    const m = cleaned.match(/^([1-3]?\s?[A-Za-z]+)\s+(\d+:\d+(?:-\d+)?)$/);
    if (!m) return ref;
  
    const bookKey = m[1].replace(/\s+/g, "");
    const rest = m[2];
  
    const fullBook = STRONG_BOOK_MAP[bookKey];
    if (!fullBook) return ref;
  
    return `${fullBook} ${rest}`;
  }
  

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

  const loadCrossRefsWithLlamaFallback = useCallback(async () => {
    const key = buildKey("Cross-references", language) + "::llama";
    const cached = localCache.current.get(key);
    if (cached != null) return cached;
  
    try {
      const verseText =
        language === "TE"
          ? verseData.text.BSI_TELUGU || verseData.text.KJV
          : verseData.text[englishVersion] || verseData.text.KJV;
  
      const refLabel = `${verseRef.book} ${verseRef.chapter}:${verseRef.verse}`;
  
      const prompt = `
  Suggest Bible cross-references related to the THEMES of the verse below.
  
  STRICT RULES:
  - Return ONLY Bible references (example: John 10:11)
  - If unsure, OMIT the reference
  - Do NOT invent verse numbers
  - Prefer well-known, widely accepted passages
  - Maximum 5 references
  - One reference per line
  - NO commentary or explanation
  
  Verse: ${refLabel}
  Text: "${verseText}"
  `.trim();
  
      const res = await sendMessageToLlama(prompt, [], language);
      const raw = res.text || "";
  
      const refs = raw
        .split(/\r?\n/)
        .map(r => r.trim())
        .filter(isValidBibleRef);
  
      const output =
        refs.length > 0
          ? `⚠️ *AI-suggested cross-references (verify)*\n\n${refs.join("\n")}`
          : "";
  
      localCache.current.set(key, output);
      return output;
    } catch (e) {
      console.error("LLaMA cross-ref fallback failed", e);
      localCache.current.set(key, "");
      return "";
    }
  }, [verseRef, verseData, language, englishVersion, buildKey]);
  const loadCrossReferencesWithGemini = useCallback(async () => {
    const key = buildKey("Cross-references", language);
    const cached = localCache.current.get(key);
    if (cached != null) return cached;
  
    const text =
      (await getVerseAnalysis(
        verseRef,
        "Cross-references",
        language
      )) || "";
  
    localCache.current.set(key, text);
    return text;
  }, [verseRef, language, buildKey]);
  
  const loadHistoricalContextWithGemini = useCallback(async () => {
    const key = buildKey("Historical Context", language);
    const cached = localCache.current.get(key);
    if (cached != null) return cached;
  
    const text =
      (await getVerseAnalysis(
        verseRef,
        "Historical Context",
        language
      )) || "";
  
    localCache.current.set(key, text);
    return text;
  }, [verseRef, language, buildKey]);
  
  
  
  const loadHistoricalWithLlamaFallback = useCallback(async () => {
    const key = buildKey("Historical Context", language) + "::llama";
    const cached = localCache.current.get(key);
    if (cached != null) return cached;
  
    try {
      const verseText =
        language === "TE"
          ? verseData.text.BSI_TELUGU || verseData.text.KJV
          : verseData.text[englishVersion] || verseData.text.KJV;
  
      const refLabel = `${verseRef.book} ${verseRef.chapter}:${verseRef.verse}`;
  
      const prompt = `
  Provide ONLY historical and cultural background for the Bible verse below.
  
  RULES:
  - Cultural + social background only
  - NO theology
  - NO invented dates/events
  - Admit uncertainty if present
  
  Verse: ${refLabel}
  Text: "${verseText}"
  
  Respond in ${language === "TE" ? "Telugu" : "English"}.
  `.trim();
  
      const res = await sendMessageToLlama(prompt, [], language);
      const text = res.text?.trim() || "";
  
      const output = text
        ? `⚠️ *AI-generated historical background (verify)*\n\n${text}`
        : "";
  
      localCache.current.set(key, output);
      return output;
    } catch (e) {
      console.error("LLaMA historical fallback failed", e);
      localCache.current.set(key, "");
      return "";
    }
  }, [verseRef, verseData, language, englishVersion, buildKey]);
  
  


  const loadSummaryWithLlama = useCallback(async () => {
    const key = buildKey("Summary", language);
    const cached = localCache.current.get(key);
    if (cached != null) return cached;
  
    const verseText =
      language === "TE"
        ? verseData.text.BSI_TELUGU || verseData.text.KJV
        : verseData.text[englishVersion] || verseData.text.KJV;
  
    if (!verseText) return "";
  
    const refLabel =
      language === "TE"
        ? `${TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book} ${verseRef.chapter}:${verseRef.verse}`
        : `${verseRef.book} ${verseRef.chapter}:${verseRef.verse}`;
  
    const langInstruction =
      language === "TE"
        ? "సంక్షిప్తంగా, స్పష్టంగా తెలుగులో వివరణ ఇవ్వండి."
        : "Give a clear, concise explanation in English.";
  
        const prompt = `
        Provide a deep, structured explanation of the following Bible verse.
        
        Requirements:
        - Explain the verse in DETAIL
        - Cover cultural background
        - Explain theological meaning
        - Explain why this verse is important in Scripture
        - End with practical or spiritual implications
        
        Formatting rules:
        - Use clear Markdown
        - Use short paragraphs
        - Use bullet points where helpful
        - Do NOT quote long passages from other verses
        - Do NOT invent doctrine
        
        Verse Reference: ${refLabel}
        Verse Text:
        "${verseText}"
        
        Language instruction:
        ${langInstruction}
        `.trim();
        
  
        let output = "";
        try {
          const response = await sendMessageToLlama(prompt, [], language);
          output = response.text?.trim() || "";
        } catch (e) {
          console.error("LLaMA summary failed", e);
          output = "";
        }
        
    localCache.current.set(key, output);
    return output;
  }, [verseRef, verseData, language, englishVersion, buildKey]);
  

  /* -------------------------
    loadTab (analysis)
  ---------------------------*/
  const loadTab = useCallback(
    async (tab: Tab) => {
      if (tab === "Interlinear") {
        const cacheKey = buildKey("Interlinear", "EN");
      
        if (localCache.current.has(cacheKey)) {
          return "__INTERLINEAR__";
        }
      
        const isNT = isNewTestament(verseRef.book);
      
        const rows = isNT
  ? await fetchNTInterlinear(
      verseRef.book,
      verseRef.chapter,
      verseRef.verse
    )
  : await fetchOTInterlinear(
      verseRef.book,
      verseRef.chapter,
      verseRef.verse
    );

      
    setInterlinearRows(rows || []);

    if (rows && rows.length > 0) {
      if (!isNT) {
        await preloadStrongLexicons(rows);
      }
    
      if (isNT) {
        setOriginalVerse(buildGreekVerse(rows));
        setTranslitVerse(buildTransliterationVerse(rows));
      } else {
        setOriginalVerse(buildHebrewVerse(rows));
        setTranslitVerse(
          rows
            .slice()
            .sort((a, b) => a.word_index - b.word_index)
            .map(r => strongCache[r.strong]?.transliteration || "")
            .filter(Boolean)
            .join(" ")
        );
      }
    }
    
         else {
          setOriginalVerse("");
          setTranslitVerse("");
        }
      
        localCache.current.set(cacheKey, "__INTERLINEAR__");
        return "__INTERLINEAR__";
      }
      
  
      if (tab === "Notes") return "";
      if (tab === "Summary") return "";
  
      const key = buildKey(tab, language);
      const cached = localCache.current.get(key);
      if (cached != null) return cached;
  
      setErrorMsg("");
  
      try {
        if (language === "EN") return "";
        return "";
      } catch (e: any) {
        console.error("loadTab error", e);
        setErrorMsg(
          language === "TE"
            ? "కంటెంట్ లోడ్ కాలేదు."
            : "Failed to load content."
        );
        return "";
      }
    },
    [verseRef, language, buildKey]
  );
  
  /* -------------------------
    Effects
  ---------------------------*/
  useEffect(() => {
    if (activeTab !== "Interlinear") return;
    if (!scrollContainerRef.current) return;
  
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number(
              (e.target as HTMLElement).dataset.wordIndex
            );
            if (!Number.isNaN(idx)) {
              setActiveWordIndex(idx);
            }
          }
        }
      },
      {
        root: scrollContainerRef.current,
  
        // 🔑 Activation line = just below sticky header
        rootMargin: `-${stickyHeight}px 0px -30% 0px`,
  
        // 🔑 Trigger when top edge crosses
        threshold: 0,
      }
    );
  
    wordRefs.current.forEach((el) => observer.observe(el));
  
    return () => observer.disconnect();
  }, [activeTab, interlinearRows, stickyHeight]);
  
  
  useEffect(() => {
    if (!originalBlockRef.current) return;
  
    const update = () => {
      setStickyHeight(originalBlockRef.current!.offsetHeight);
    };
  
    update();
  
    const ro = new ResizeObserver(update);
    ro.observe(originalBlockRef.current);
  
    return () => ro.disconnect();
  }, []);
  
  useEffect(() => {
    if (activeTab === "Summary" || activeTab === "Notes") {
      setAdvancedOpen(false);
    }
  }, [activeTab]);
  
  useEffect(() => {
    if (!interlinearRows.length) return;
  
    // Trigger re-render so cached Strong data shows in cards
    setInterlinearRows((rows) => [...rows]);
  }, [strongCache]);
  
  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeTab]);
  
  useEffect(() => {
    if (activeTab !== "Interlinear") return;
  
    (async () => {
      setLoading(true);
      try {
        await loadTab("Interlinear");
        setAnalysis(prev => ({
          ...prev,
          Interlinear: "__INTERLINEAR__",
        }));
      } finally {
        setLoading(false);
      }
    })();
  }, [activeTab, loadTab]);
  
  useEffect(() => {
    if (activeTab === "Interlinear") {
      setLanguage("EN");
    }
  }, [activeTab]);
  
  useEffect(() => {
    if (isPreviewOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  
    return () => {
      document.body.style.overflow = "";
    };
  }, [isPreviewOpen]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (!menuOpen) return;
  
      const target = e.target as Node;
  
      // If clicking the button, don't auto-close.
      if (menuButtonRef.current?.contains(target)) return;
  
      // If clicking inside menu, don't auto-close.
      if (menuRef.current?.contains(target)) return;
  
      setMenuOpen(false);
    };
  
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);
  
  useEffect(() => {
    localCache.current.clear();
    refCache.current.clear();
  
    setAnalysis(prev => ({
      ...prev,
      Notes: null,
      Summary: null,
      "Cross-references": null,
      "Historical Context": null,
      Interlinear: null,
    }));
  
    setErrorMsg("");
  
    // ❌ DO NOT reset activeTab here
  }, [verseRef]);
  

  useEffect(() => {
    const existing = getNoteFor(verseRef);
    setNoteText(existing?.content ?? "");
  }, [verseRef, getNoteFor]);
  useEffect(() => {
    // Sync VerseTools language with selected version (SINGLE mode behavior)
    if (isTeluguVersion(englishVersion)) {
      setLanguage("TE");
    } else {
      setLanguage("EN");
    }
  }, [englishVersion, verseRef]);
  

  useEffect(() => {
    // AI tabs only — NEVER touch Interlinear here
    if (
      activeTab === "Notes" ||
      activeTab === "Interlinear"
    ) {
      return;
    }
  
    setAnalysis(prev => ({
      ...prev,
      [activeTab]: null,
    }));
    setErrorMsg("");
  }, [language, activeTab]);
  

  const handleGenerateClick = useCallback(async () => {
    if (activeTab === "Notes") return;
  
    setLoading(true);
    setErrorMsg("");
  
    try {
      let text = "";
  
      if (activeTab === "Summary") {
        const primary = await loadTab("Summary");
        text = primary && primary.trim()
          ? primary
          : await loadSummaryWithLlama();
  
      } else if (activeTab === "Cross-references") {
        text = await loadCrossReferencesWithGemini();
  
      } else if (activeTab === "Historical Context") {
        text = await loadHistoricalContextWithGemini();
  
      } else {
        // Interlinear or any future tab
        text = await loadTab(activeTab);
      }
  
      setAnalysis(prev => ({
        ...prev,
        [activeTab]: text,
      }));
    } catch (e) {
      console.error("Generate failed", e);
      setErrorMsg(
        language === "TE"
          ? "విశ్లేషణ సృష్టించడంలో లోపం వచ్చింది."
          : "Failed to generate analysis."
      );
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    loadTab,
    loadSummaryWithLlama,
    loadCrossReferencesWithGemini,
    loadHistoricalContextWithGemini,
    language,
  ]);
  
  
  

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
  
      // ✅ STRING — run regex
      if (typeof node === "string") {
        const parts: React.ReactNode[] = [];
        const regex = new RegExp(INLINE_REF_RENDER_REGEX.source, "gu");
  
        let lastIndex = 0;
        let m: RegExpExecArray | null;
  
        while ((m = regex.exec(node)) !== null) {
          const match = m[1];
          const start = m.index;
  
          if (start > lastIndex) {
            parts.push(node.slice(lastIndex, start));
          }
  
          parts.push(
            <span
              key={`ref-${start}-${match}`}
              role="button"
              tabIndex={0}
              className="text-blue-600 dark:text-blue-400 underline cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleClickReference(match);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleClickReference(match);
              }}
            >
              {match}
            </span>
          );
  
          lastIndex = start + match.length;
        }
  
        if (lastIndex < node.length) {
          parts.push(node.slice(lastIndex));
        }
  
        return parts.length ? parts : node;
      }
  
      // ✅ ARRAY — recurse
      if (Array.isArray(node)) {
        return node.map((child, i) => (
          <React.Fragment key={i}>
            {renderNodeWithRefs(child)}
          </React.Fragment>
        ));
      }
  
      // ✅ REACT ELEMENT — CLONE & RECURSE INTO CHILDREN
      if (React.isValidElement(node)) {
        const props = node.props as { children?: React.ReactNode };
      
        return React.cloneElement(
          node,
          props,
          renderNodeWithRefs(props.children)
        );
      }
      
      return node;
    },
    [handleClickReference]
  );
  

  const renderStrongDefinition = useCallback(
    (text: string) => {
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
  
      for (const match of text.matchAll(STRONG_REF_REGEX)) {
        const ref = match[0];
        const start = match.index ?? 0;
  
        if (start > lastIndex) {
          parts.push(
            renderGreekStyled(text.slice(lastIndex, start))
          );
        }
  
        parts.push(
          <span
            key={`${ref}-${start}`}
            role="button"
            className="text-blue-600 dark:text-blue-400 underline cursor-pointer"
            onClick={() => handleClickReference(normalizeStrongRef(ref))}
          >
            {ref}
          </span>
        );
  
        lastIndex = start + ref.length;
      }
  
      if (lastIndex < text.length) {
        parts.push(
          renderGreekStyled(text.slice(lastIndex))
        );
      }
  
      return parts;
    },
    [handleClickReference]
  );
  function renderGreekStyled(chunk: string): React.ReactNode {
    const nodes: React.ReactNode[] = [];
    let last = 0;
  
    for (const m of chunk.matchAll(GREEK_WORD_REGEX)) {
      const greek = m[0];
      const idx = m.index ?? 0;
  
      if (idx > last) {
        nodes.push(chunk.slice(last, idx));
      }
  
      nodes.push(
        <span
          key={`${greek}-${idx}`}
          className="font-serif font-semibold px-1 rounded bg-gray-100 dark:bg-gray-800"

        >
          {greek}
        </span>
      );
  
      last = idx + greek.length;
    }
  
    if (last < chunk.length) {
      nodes.push(chunk.slice(last));
    }
  
    return nodes;
  }
    
  function buildHebrewVerse(rows: any[]): string {
    return rows
      .slice()
      .sort((a, b) => a.word_index - b.word_index)
      .map(r => cleanHebrewSurface(r.surface))
      .join(" ");
  }

  
  
  function openStrong(row: any) {
    const strong = row.strong;
    if (!strong) return;
  
    const isNT = isNewTestament(verseRef.book);
  
    // ---------- NT ----------
    if (isNT) {
      setStrongPopup({
        strong,
        lemma: row.lemma || "",
        lexicon: formatGreekLexicon(row.definition || ""),
      });
      return;
    }
    
  
    // ---------- OT ----------
    const cached = strongCache[strong];

if (cached) {
  setStrongPopup({
    strong,
    lemma: cached.lemma || cleanHebrewSurface(row.surface),
    lexicon: {
      transliteration: cached.transliteration,
      coreMeaning: cached.meaning,
      sections: cached.definition
        ? [{ title: "Definition", bullets: [cached.definition] }]
        : [],
    },
  });
  return;
}


  
    // Fetch OT Strong
    fetchStrongLexicon(strong).then((lex) => {
      if (!lex) return;
  
      const cachedData = {
        lemma: lex.hebrew || "",
        transliteration: lex.transliteration || "",
        meaning: lex.gloss || "",
        definition: lex.meaning || "",

      };
  
      setStrongCache((prev) => ({
        ...prev,
        [strong]: cachedData,
      }));
  
      setStrongPopup({
        strong,
        lemma: cachedData.lemma,
        lexicon: {
          transliteration: cachedData.transliteration,
          coreMeaning: cachedData.meaning,
          sections: cachedData.definition
            ? [{ title: "Definition", bullets: [cachedData.definition] }]
            : [],
        },
      });
    });
  }
  
  
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
  <div className="relative" ref={menuRef}>
  <button
    ref={menuButtonRef}
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
  onClick={() => {
    setMenuOpen(false);
    handleShareAsImage();
  }}
  className="w-full px-4 py-2 flex items-center gap-3 text-left 
             text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
>
  <i className="fas fa-image w-4" />
  Share as Image
</button>


        <button
  onClick={() => {
    setMenuOpen(false);

    // Open ProfileNotes with incoming verse
    window.dispatchEvent(
      new CustomEvent("open-profile-notes", {
        detail: {
          ref: verseRef,
          text: displayVerseText,
        },
      })
    );

    // ✅ CLOSE VerseTools (important for mobile UX)
    onClose?.();
  }}
  className="w-full px-4 py-2 flex items-center gap-3 text-left 
             text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
>
  <i className="fas fa-bookmark w-4" />
  Add to Topical Notes
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
  <p className="text-gray-800 dark:text-gray-200 italic text-sm mt-2 leading-relaxed">
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
<div className="mb-4">
  {/* PRIMARY ROW */}
  <div className="border-b border-gray-200 dark:border-gray-700">
    <nav className="-mb-px flex items-center space-x-6">
      {PRIMARY_TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => {
            setActiveTab(tab);
            setAdvancedOpen(false); // 🔑 collapse advanced
            setErrorMsg("");
          }}
          className={`py-3 border-b-2 text-sm font-medium ${
            activeTab === tab
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 dark:text-gray-400"
          }`}
        >
          {language === "TE"
            ? tab === "Summary"
              ? "సారాంశం / వివరణ"
              : "గమనికలు"
            : tab}
        </button>
      ))}

      {/* ADVANCED TOGGLE */}
      <button
        onClick={() => setAdvancedOpen((v) => !v)}
        className="py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700"
      >
        Advanced {advancedOpen ? "▴" : "▾"}
      </button>
    </nav>
  </div>

  {/* ADVANCED ROW */}
  {advancedOpen && (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <nav className="flex space-x-6 px-1">
        {ADVANCED_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setErrorMsg("");
            }}
            className={`py-2 text-sm border-b-2 ${
              activeTab === tab
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            {language === "TE"
              ? tab === "Interlinear"
                ? "పదాల వారీ అనువాదం"
                : tab === "Cross-references"
                ? "సంబంధిత వచనాలు"
                : "చారిత్రక నేపథ్యం"
              : tab}
          </button>
        ))}
      </nav>
    </div>
  )}
</div>


      {/* Main content */}
      <div
  ref={scrollContainerRef}
  className="flex-grow overflow-y-auto pr-2"
>



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
            ) : activeTab === "Interlinear" ? (
              loading ? (
                <LoadingSkeleton />
              ) : interlinearRows.length > 0 ? (
                <div className="space-y-4">
                  {/* ORIGINAL TEXT + TRANSLITERATION */}
                  {originalVerse && (
                    <div
                    ref={originalBlockRef}
                    className="
                      sticky top-0 z-10
                      p-3 rounded-md
                      bg-gray-50 dark:bg-gray-900
                      border border-gray-200 dark:border-gray-700
                      space-y-2
                      backdrop-blur-sm
                    "
                  >
                  
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Original Text
                      </p>
            
                      {isNewTestament(verseRef.book) ? (
  /* ---------- NT (Greek – LTR) ---------- */
  <p
    dir="ltr"
    className="
      text-2xl
      font-serif
      leading-relaxed
      tracking-wide
      text-left
      flex
      flex-wrap
      gap-x-1
    "
  >
    {interlinearRows
      .slice()
      .sort((a, b) => a.word_index - b.word_index)
      .map((r, i) => {
        const idx = r.word_index ?? i;
      
        return (
          <span
            key={idx}
            className={`
              cursor-pointer
              rounded
              px-0.5
              ${
                activeWordIndex === idx
                  ? "bg-yellow-200 dark:bg-yellow-600"
                  : "hover:bg-yellow-200 dark:hover:bg-yellow-600"
              }
            `}
            onMouseEnter={() => handleWordHover(idx)}
            onClick={() => handleWordClick(idx)}
          >
            {r.surface}
          </span>
        );
      })
      }
  </p>
) : (
  /* ---------- OT (Hebrew – RTL) ---------- */
  <p
    dir="rtl"
    className="
      text-2xl
      font-serif
      leading-relaxed
      tracking-wide
      text-right
      unicode-bidi-override
      flex
      flex-wrap
      gap-x-1
    "
  >
    {interlinearRows
      .slice()
      .sort((a, b) => a.word_index - b.word_index)
      .map((r, i) => {
        const idx = r.word_index ?? i;
      
        return (
          <span
            key={idx}
            dir="rtl"
            className={`
              cursor-pointer
              rounded
              px-0.5
              ${
                activeWordIndex === idx
                  ? "bg-yellow-200 dark:bg-yellow-600"
                  : "hover:bg-yellow-200 dark:hover:bg-yellow-600"
              }
            `}
            onMouseEnter={() => handleWordHover(idx)}
            onClick={() => handleWordClick(idx)}
          >
            {cleanHebrewSurface(r.surface)}
          </span>
        );
      })
      }
  </p>
)}


                      {translitVerse && (
                        <>
                          <p className="text-xs uppercase tracking-wide text-gray-500 mt-2">
                            Transliteration
                          </p>
                          <p className="text-sm italic text-gray-600 dark:text-gray-400">
                            {translitVerse}
                          </p>
                        </>
                      )}
                    </div>
                  )}
            
                  {/* WORD-BY-WORD */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {interlinearRows.map((r, i) => {
                      const isNT = isNewTestament(verseRef.book);
                      const row = normalizeInterlinearRow(r, isNT);
                      const cached = row.strong ? strongCache[row.strong] : null;

const effectiveLemma =
  row.lemma ||
  cached?.lemma ||
  cleanHebrewSurface(row.surface);

const effectiveTranslit =
  row.transliteration ||
  cached?.transliteration ||
  "";

const effectiveMeaning =
  row.meaning ||
  cached?.meaning ||
  "";


                      


            
                      return (
                        <div
                        data-word-index={r.word_index ?? i}
  key={`${verseRef.book}-${verseRef.chapter}-${verseRef.verse}-w${i}-${r.word_index ?? "x"}-${r.strong ?? "ns"}`}
  ref={(el) => {
    if (el) {
      const refKey = r.word_index ?? i;
      wordRefs.current.set(refKey, el);
    }
  }}
  className={`
    rounded-lg border px-4 py-3 dark:border-gray-700
    transition-colors
    ${
      activeWordIndex === (r.word_index ?? i)
        ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-800/40"
        : "bg-white dark:bg-gray-900"
    }
  `}
>
  {/* SURFACE — HERO */}
  <div className="text-2xl font-serif font-semibold leading-tight">
    {isNewTestament(verseRef.book)
      ? row.surface
      : cleanHebrewSurface(row.surface)}
  </div>

  {/* LEMMA — QUIET */}
  <div className="text-sm font-serif text-gray-500 dark:text-gray-400">
    {effectiveLemma || "—"}
  </div>

  {/* MEANING — PRIMARY CONTENT */}
  <div className="mt-2 text-sm text-gray-900 dark:text-gray-100">
    {effectiveMeaning || "—"}
  </div>

  {/* SECONDARY META ROW */}
  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
    {effectiveTranslit && (
      <span className="italic">{effectiveTranslit}</span>
    )}

    {row.strong && (
      <button
        onClick={() => openStrong(row)}
        className="
          px-2 py-0.5 rounded
          border border-gray-300 dark:border-gray-600
          hover:bg-gray-100 dark:hover:bg-gray-800
          text-gray-700 dark:text-gray-300
        "
      >
        {row.strong}
      </button>
    )}
  </div>
</div>

                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Interlinear data not available for this verse.
                </p>
              )
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
    p({ children }) {
      return <p>{renderNodeWithRefs(children)}</p>;
    },
    li({ children }) {
      return <li>{renderNodeWithRefs(children)}</li>;
    },
  }}
>
  {analysis[activeTab] ?? ""}
</ReactMarkdown>

            )
            
            }
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <ModalPortal>
          <div
  className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"

  onClick={() => setIsPreviewOpen(false)}
  style={{ pointerEvents: "auto" }}
  
  
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
      {strongPopup && (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/50 flex items-end z-[9999]"
        onClick={() => {
          setStrongPopup(null);
          setShowFullLexicon(false);
        }}
      >
        <div
          className="bg-white dark:bg-gray-900 w-full rounded-t-xl p-4 max-h-[70vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold">
            {strongPopup.lemma} ({strongPopup.strong})
          </h3>
  
          {/* Transliteration */}
{strongPopup.lexicon.transliteration && (
  <>
<p className="mt-3 text-xs uppercase tracking-wide text-gray-500">
Transliteration
</p>
<p className="text-sm text-gray-800 dark:text-gray-200">
{strongPopup.lexicon.transliteration}
</p>
</>
)}

{/* Core Meaning */}
{strongPopup.lexicon.coreMeaning && (
  <>
  <p className="mt-3 text-xs uppercase tracking-wide text-gray-500">
    Meaning
  </p>
  <p className="text-sm text-gray-800 dark:text-gray-200">
    {strongPopup.lexicon.coreMeaning || "See detailed lexicon"}
  </p>
</>

)}

{/* Detailed Sections */}
{strongPopup.lexicon.sections.map((sec) => (
  <div key={sec.title} className="mt-4">
    <p className="text-xs uppercase tracking-wide text-gray-500">
      {sec.title}
    </p>
    <ul className="list-disc ml-5 text-sm text-gray-700 dark:text-gray-300">
      {sec.bullets.map((b, j) => (
        <li key={j}>{renderStrongDefinition(b)}</li>
      ))}
    </ul>
  </div>
))}

  
          <button
            className="mt-4 block w-full py-2 bg-blue-600 text-white rounded"
            onClick={() => {
              setStrongPopup(null);
              setShowFullLexicon(false);
            }}
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