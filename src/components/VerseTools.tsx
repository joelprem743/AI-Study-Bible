// src/components/VerseTools.tsx
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  GRADIENT_PRESETS,
  NATURE_BACKGROUNDS,
} from "../constants/shareBackgrounds";
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

import { AVAILABLE_VERSIONS } from "../App";
import ShareLinkSheet from "./ShareLinkSheet";
import VerseImageShare from "./VerseImageShare";
import { buildVerseShareCaption, buildVerseShareUrl } from "../utils/share";



/* -------------------------
  Small utils / transliteration
---------------------------*/
function getWordIndex(r: any): number {
  if (typeof r.word_index !== "number") {
    throw new Error("Missing word_index in interlinear row");
  }
  return r.word_index;
}

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
    const idx = getWordIndex(r);

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
      const idx = getWordIndex(r);


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




function scrollCardIntoView(
  container: HTMLElement,
  el: HTMLElement
) {
  const containerTop = container.getBoundingClientRect().top;
  const elTop = el.getBoundingClientRect().top;

  container.scrollTo({
    top: container.scrollTop + (elTop - containerTop) - 12,
    behavior: "smooth",
  });
}



function isValidBibleRef(ref: string) {
  return /^((?:[1-3]\s*)?[A-Za-z\u0C00-\u0C7F\.']+)\s+\d+:\d+(?:-\d+)?$/.test(ref);
}

function getTabLabel(tab: Tab, lang: "EN" | "TE") {
  if (lang === "TE") {
    switch (tab) {
      case "Summary":
        return "సారాంశం";
      case "Notes":
        return "గమనికలు";
      case "Interlinear":
        return "పదాల అనువాదం";
      case "Compare":
        return "వచన పోలిక";
      case "Cross-references":
        return "సంబంధిత వచనాలు";
      case "Historical Context":
        return "చారిత్రక నేపథ్యం";
      default:
        return tab;
    }
  }
  return tab;
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

type Tab = "Interlinear" | "Summary" | "Compare" | "Cross-references" | "Historical Context" | "Notes";


type AiTab =
  | "Summary"
  | "Cross-references"
  | "Historical Context";

  function isAiTab(tab: Tab): tab is AiTab {
    return (
      tab === "Summary" ||
      tab === "Cross-references" ||
      tab === "Historical Context"
    );
  }
  
  const PRIMARY_TABS: Tab[] = [
    "Summary",
    "Compare",
    "Notes",
  ];
  
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
  `((?:${BOOK_NAME_PATTERN})\\s+\\d+:\\d+(?:-\\d+)?)(?=\\s*[.,;:—–)]|\\b)`,
  "gu"
);

const showToast = (message: string, duration = 3000) => {
  const toast = document.createElement("div");
  toast.textContent = message;

  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "rgba(0,0,0,0.85)";
  toast.style.color = "#fff";
  toast.style.padding = "10px 16px";
  toast.style.borderRadius = "999px";
  toast.style.fontSize = "14px";
  toast.style.zIndex = "10000";
  toast.style.boxShadow = "0 10px 25px rgba(0,0,0,0.3)";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 200ms ease";

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 200);
  }, duration);
};





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
  
  const MENU_LABELS = {
    EN: {
      copyVerse: "Copy Verse",
      shareVerse: "Share Verse",
      shareImage: "Share as Image",
      addNotes: "Add to Notes",
      language: "Language",
    },
    TE: {
      copyVerse: "వచనం కాపీ చేయి",
      shareVerse: "వచనం షేర్ చేయి",
      shareImage: "చిత్రంగా షేర్ చేయి",
      addNotes: "నోట్స్‌కి జోడించు",
      language: "భాష",
    },
  } as const;

  const lockScroll = () => {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
  };
  
  const unlockScroll = () => {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  };
  

  function getAiActionText(tab: Tab, lang: "EN" | "TE") {
    if (lang === "TE") {
      switch (tab) {
        case "Summary":
          return "వివరణ చూడండి";
        case "Cross-references":
          return "సంబంధిత వచనాలు చూపించు";
        case "Historical Context":
          return "చారిత్రక నేపథ్యం చూడండి";
        default:
          return "వివరణ చూడండి";
      }
    }
  
    switch (tab) {
      case "Summary":
        return "Explain";
      case "Cross-references":
        return "Show Cross References";
      case "Historical Context":
        return "Show Historical Context";
      default:
        return "Explain";
    }
  }
  
  function getAiEmptyHintText(tab: Tab, lang: "EN" | "TE") {
    if (lang === "TE") {
      switch (tab) {
        case "Summary":
          return "ఈ వచనానికి వివరణ చూడాలంటే బటన్ నొక్కండి.";
        case "Cross-references":
          return "సంబంధిత వచనాలు చూడాలంటే బటన్ నొక్కండి.";
        case "Historical Context":
          return "చారిత్రక నేపథ్యం చూడాలంటే బటన్ నొక్కండి.";
        default:
          return "వివరణ చూడాలంటే బటన్ నొక్కండి.";
      }
    }
  
    switch (tab) {
      case "Summary":
        return "Tap to view the explanation for this verse.";
      case "Cross-references":
        return "Tap to view related cross references.";
      case "Historical Context":
        return "Tap to view the historical background.";
      default:
        return "Tap to view the explanation.";
    }
  }
  
  const ADVANCED_LABEL = {
    EN: "More",
    TE: "మరిన్ని",
  } as const;
  
  
/* -------------------------
  Component
---------------------------*/
export const VerseTools: React.FC<{
  verseRef: VerseReference;
  verseData: Verse;
  uiLanguage: "EN" | "TE";
  demoTriggerShareImage?: boolean;
  bibleVersion: string;
  onClose?: () => void;
  currentHighlight?: string;
  demoTriggerShare?: boolean;
  demoTriggerHighlight?: boolean;
  onHighlightChange?: (color: string | null) => void;
}> = ({
  verseRef,
  verseData,
  uiLanguage,
  bibleVersion,
  onClose,
  currentHighlight,
  onHighlightChange,
  demoTriggerShare,
  demoTriggerHighlight,
  demoTriggerShareImage,   
}) => {

  const { getNoteFor, refreshNoteFor, saveNoteFor } = useNotes();
  const isTeluguVersion = (version?: string) =>
    version === "TELUGU_COMMUNITY_V1";
  type ShareLayout = "portrait" | "square";

  const [shareLayout, setShareLayout] = useState<ShareLayout>("square");
  const [shareVerses, setShareVerses] = useState<string[]>([]);
  const [previewRef, setPreviewRef] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareSheetText, setShareSheetText] = useState("");
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [selectedGradient, setSelectedGradient] = useState<{
    from: string;
    to: string;
  } | null>(null);
  

  const gradientSectionRef = useRef<HTMLDivElement | null>(null);
  const [highlightShareCTA, setHighlightShareCTA] = useState(false);

  const shareActionsRef = useRef<HTMLDivElement | null>(null);

  // Background selection for verse images
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);

  type ShareStep = "background" | "content" | null;

const [shareStep, setShareStep] = useState<ShareStep>(null);

const demoBanner =
  demoTriggerShare &&
  shareStep === "background";

useEffect(() => {
  if (!demoTriggerShare) return;

  // Guided demo starts at background selection
  setShareStep("background");

  // Smooth scroll to backgrounds
  setTimeout(() => {
    gradientSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, 300);

  // Pulse CTA
  setHighlightShareCTA(true);

  setTimeout(() => {
    setHighlightShareCTA(false);
  }, 4000);

}, [demoTriggerShare]);


useEffect(() => {
  if (!demoTriggerShareImage) return;

  // Default verse
  setShareVerses([
    language === "TE"
      ? displayTeluguVerse || displayEnglishVerse
      : displayEnglishVerse,
  ]);

  // 🔥 Use first background image for demo
  setSelectedBackground(NATURE_BACKGROUNDS[0].url);
  setSelectedGradient(null);

  // Open image preview directly
  setShareStep("content");
}, [demoTriggerShareImage]);


  // Optional church attribution (VerseTools only)
const [includeChurchName, setIncludeChurchName] = useState(false);
const [churchName, setChurchName] = useState("");


  const verseContainerRef = useRef<HTMLDivElement | null>(null);
const [isLongVerse, setIsLongVerse] = useState(false);

  const [language, setLanguage] = useState<"EN" | "TE">(uiLanguage);
  const isTeluguUI = language === "TE";

  const teluguClass = isTeluguUI ? "font-telugu" : "";

  const [previewHighlight, setPreviewHighlight] =
  useState<string | null>(null);



  const [activeTab, setActiveTab] = useState<Tab>("Summary");

  const [originalVerse, setOriginalVerse] = useState<string>("");
  const [translitVerse, setTranslitVerse] = useState<string>("");
  const L = MENU_LABELS[language];

  const [compareVerses, setCompareVerses] = useState<
  { version: string; text: string }[]
>([]);


const [analysis, setAnalysis] = useState<Record<AiTab, string | null>>({
  Summary: null,
  "Cross-references": null,
  "Historical Context": null,
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const touchMovedRef = useRef(false);



  const highlightRef = useRef<HTMLDivElement | null>(null);
const highlightButtonRef = useRef<HTMLButtonElement | null>(null);
const longPressTimerRef = useRef<number | null>(null);
const isLongPressActiveRef = useRef(false);
const pendingHighlightRef = useRef<string | null>(null);





  
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const verseId = `${verseRef.book}-${verseRef.chapter}-${verseRef.verse}`;
  
  const [noteText, setNoteText] = useState<string>("");
  
  const [noteStatus, setNoteStatus] = useState<
  "idle" | "typing" | "saving" | "saved" | "error"
>("idle");

const saveTimerRef = useRef<number | null>(null);
const lastSavedValueRef = useRef<string>("");

  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({} as Record<Tab, HTMLButtonElement | null>);

  const [interlinearNotice, setInterlinearNotice] = useState<string | null>(null);


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
          definition: (lex.meaning || "")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/?[^>]+>/g, "") // remove any other HTML
  .trim(),

        };
        
      }
    })
  );

  if (Object.keys(entries).length > 0) {
    setStrongCache(prev => ({ ...prev, ...entries }));
  }
}

const displayEnglishVerse =
  verseData.text[bibleVersion
  ] || verseData.text.KJV || "";   

  const VERSION_LABELS: Record<string, string> = {
    KJV: "King James Version",
    NKJV: "New King James Version",
    NIV: "New International Version",
    ESV: "English Standard Version",
    TELUGU_COMMUNITY_V1: "తెలుగు బైబిల్",
  };
  

const displayTeluguVerse =
  verseData.text.TELUGU_COMMUNITY_V1 || "";

const displayVerseText =
  language === "TE"
    ? displayTeluguVerse || displayEnglishVerse
    : displayEnglishVerse;



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
  const container = scrollContainerRef.current;

  if (el && container) {
    isProgrammaticScrollRef.current = true;

    scrollCardIntoView(container, el);

    // 🔓 Re-enable observer after scroll settles
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 600);
    
  }
};

const getCopyableContent = useCallback((): string => {
  const header =
    language === "TE"
      ? `${TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book} ${verseRef.chapter}:${verseRef.verse}`
      : `${verseRef.book} ${verseRef.chapter}:${verseRef.verse}`;

  // ---- NOTES ----
  if (activeTab === "Notes") {
    return `${header}\n\n${noteText || ""}`.trim();
  }

  // ---- INTERLINEAR (special) ----
  if (activeTab === "Interlinear") {
    if (!interlinearRows.length) return header;

    const lines = interlinearRows
      .slice()
      .sort((a, b) => a.word_index - b.word_index)
      .map((r) => {
        const cached = r.strong ? strongCache[r.strong] : null;

        const surface = isNewTestament(verseRef.book)
          ? r.surface
          : cleanHebrewSurface(r.surface);

        const lemma =
          r.lemma ||
          cached?.lemma ||
          cleanHebrewSurface(r.surface) ||
          "";

        const meaning =
          r.meaning ||
          cached?.meaning ||
          "";

        return [
          surface,
          lemma && `(${lemma})`,
          meaning && `— ${meaning}`,
          r.strong && `[${r.strong}]`,
        ]
          .filter(Boolean)
          .join(" ");
      });

    return `${header}\n\nInterlinear:\n\n${lines.join("\n")}`.trim();
  }

  
  // ---- AI TABS (Summary, Cross-refs, Historical) ----
  const content = isAiTab(activeTab) ? analysis[activeTab] : null;

  if (!content) {
    return `${header}\n\n(No content generated yet)`;
  }

  // Strip markdown bullets safely
  const plain = content
    .replace(/^#+\s*/gm, "")
    .replace(/^\*\s+/gm, "• ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();

  return `${header}\n\n${plain}`;
}, [
  activeTab,
  analysis,
  interlinearRows,
  strongCache,
  noteText,
  verseRef,
  language,
]);

const handleCopyTabContent = useCallback(async () => {
  try {
    const text = getCopyableContent();
    if (!text) return;

    await navigator.clipboard.writeText(text);
    // ✅ silent success (same behavior as Copy Verse)
  } catch (err) {
    console.error("Copy tab content failed", err);
  }
}, [getCopyableContent]);


const loadCompare = useCallback(async () => {
  const versions = AVAILABLE_VERSIONS;

  const results = await Promise.allSettled(
    versions.map(async (version) => {
      const chapter = await fetchChapter(
        verseRef.book,
        verseRef.chapter,
        version
      );

      const verse = chapter.find(v => v.verse === verseRef.verse);
      if (!verse || !verse.text) return null;

      const text =
  verse.text[version] ??
  verse.text.TELUGU_COMMUNITY_V1 ??
  verse.text.KJV ??
  "";


      if (!text) return null;

      return { version, text };
    })
  );

  const rows = results
    .filter(r => r.status === "fulfilled" && r.value)
    .map(r => (r as PromiseFulfilledResult<any>).value);

  setCompareVerses(rows);
}, [verseRef]);





const handleWordSelect = (idx: number) => {
  setActiveWordIndex(idx);

  const el = wordRefs.current.get(idx);
  const container = scrollContainerRef.current;

  if (el && container) {
    scrollCardIntoView(container, el);
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
    const displayBook =
    language === "TE"
      ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
      : verseRef.book;
  
  const caption = buildVerseShareCaption(
    displayBook,
    verseRef.chapter,
    verseRef.verse,
    displayVerseText,
    language
  );
  
    const url = buildVerseShareUrl(
      verseRef.book,
      verseRef.chapter,
      verseRef.verse
    );
  
    if (navigator.share) {
      try {
        await navigator.share({
          text: caption,
          url,
        });
        return;
      } catch (err) {
        console.error("Native share failed:", err);
      }
    }
  
    await navigator.clipboard.writeText(`${caption}\n\n${url}`);
  };
  



  // Open background selector first
  const handleShareAsImageClick = async () => {

    const chapter = await fetchChapter(
      verseRef.book,
      verseRef.chapter,
      language === "TE"
        ? "TELUGU_COMMUNITY_V1"
        : bibleVersion
    );
  
    const start = verseRef.verse;
    const end = verseRef.verse; // change later if you support range selection
  
    const verses = chapter
      .filter(v => v.verse >= start && v.verse <= end)
      .map(v =>
        language === "TE"
          ? v.text.TELUGU_COMMUNITY_V1 || v.text.KJV || ""
          : v.text[bibleVersion] || v.text.KJV || ""
      );
  
setShareVerses(verses);

setSelectedBackground(null);
setSelectedGradient(null);

setShareStep("background");
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

        const chapterData = await fetchChapter(
          meta.name,
          chapter,
          language === "TE" ? "TELUGU_COMMUNITY_V1" : bibleVersion

        );
        
        if (!chapterData || !chapterData.length) return "";

        const selected = chapterData.filter(
          (v) => v.verse >= startVerse && v.verse <= endVerse
        );
        if (!selected.length) return "";

        const out = selected
        .map((v) =>
          language === "TE"
            ? v.text.TELUGU_COMMUNITY_V1 || v.text.KJV || ""
            : v.text[bibleVersion
            ] || v.text.KJV || ""
        )
        
          .join("\n");

        refCache.current.set(cacheKey, out);
        return out;
      } catch (err) {
        console.error("loadReferenceText error", err);
        return "";
      }
    },
    [language, bibleVersion
    ]
  );

  const loadCrossRefsWithLlamaFallback = useCallback(async () => {
    const key = buildKey("Cross-references", language) + "::llama";
    const cached = localCache.current.get(key);
    if (cached != null) return cached;
  
    try {
      const verseText =
  language === "TE"
    ? verseData.text.TELUGU_COMMUNITY_V1 || verseData.text.KJV
    : verseData.text[bibleVersion
    ] || verseData.text.KJV;

  
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
  }, [verseRef, verseData, language, bibleVersion
    , buildKey]);
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
          ? verseData.text.TELUGU_COMMUNITY_V1 || verseData.text.KJV
          : verseData.text[bibleVersion
          ] || verseData.text.KJV;
  
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
  }, [verseRef, verseData, language, bibleVersion
    , buildKey]);
  
  


  const loadSummaryWithLlama = useCallback(async () => {
    const key = buildKey("Summary", language);
    const cached = localCache.current.get(key);
    if (cached != null) return cached;
  
    const verseText =
      language === "TE"
        ? verseData.text.TELUGU_COMMUNITY_V1 || verseData.text.KJV
        : verseData.text[bibleVersion
        ] || verseData.text.KJV;
  
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
        
        Formatting rules (MANDATORY):
        - Use Markdown headings with ## for section titles
        - DO NOT write section titles as plain text
        - Example (Telugu):
          ## పరిచయం
          ## సారాంశం
          ## దైవశాస్త్ర అర్థం
          ## ప్రాముఖ్యత
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
  }, [verseRef, verseData, language, bibleVersion
    , buildKey]);
  

  /* -------------------------
    loadTab (analysis)
  ---------------------------*/
  const loadTab = useCallback(
    async (tab: Tab) => {
      // ---------- INTERLINEAR ----------
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
          if (!isNT) await preloadStrongLexicons(rows);
  
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
  
        localCache.current.set(cacheKey, "__INTERLINEAR__");
        return "__INTERLINEAR__";
      }
  
      // ---------- NOTES ----------
      if (tab === "Notes") {
        return "";
      }
  
      // ---------- AI TABS ----------

      try {
        if (!isAiTab(tab)) {
          return "";
        }
        
        const key = buildKey(tab, language);
        const cached = localCache.current.get(key);
        if (cached != null) return cached;
        
        setErrorMsg("");
        
        switch (tab) {
          case "Summary":
            return await loadSummaryWithLlama();
        
          case "Cross-references":
            return await loadCrossReferencesWithGemini();
        
          case "Historical Context":
            return await loadHistoricalContextWithGemini();
        }
        
      } catch (e) {
        console.error("loadTab error", e);
        setErrorMsg(
          language === "TE"
            ? "కంటెంట్ లోడ్ కాలేదు."
            : "Failed to load content."
        );
        return "";
      }
    },
    [
      verseRef,
      language,
      buildKey,
      loadSummaryWithLlama,
      loadCrossReferencesWithGemini,
      loadHistoricalContextWithGemini,
    ]
  );
  
  
  /* -------------------------
    Effects
  ---------------------------*/
  useEffect(() => {
    if (!demoTriggerHighlight) return;
  
    setPreviewHighlight("yellow");
    onHighlightChange?.("yellow");
    setHighlightOpen(true);
  
    const t = setTimeout(() => {
      setHighlightOpen(false);
    }, 1500);
  
    return () => clearTimeout(t);
  
  }, [demoTriggerHighlight, onHighlightChange]);
  
  
  useEffect(() => {
    NATURE_BACKGROUNDS.forEach((bg) => {
      const img = new Image();
      img.src = bg.url;
    });
  }, []);

  useEffect(() => {
    const handleDemoStepChange = () => {
      // Close share preview when demo moves to next step
      setShareStep(null);
    };
  
    window.addEventListener("demo-next-step", handleDemoStepChange);
  
    return () => {
      window.removeEventListener("demo-next-step", handleDemoStepChange);
    };
  }, []);
  
  useEffect(() => {
    if (shareStep === "content") {
      window.dispatchEvent(
        new CustomEvent("demo-behind-modal", { detail: true })
      );
    }
  
    return () => {
      window.dispatchEvent(
        new CustomEvent("demo-behind-modal", { detail: false })
      );
    };
  }, [shareStep]);
  

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []);
  

  useEffect(() => {
    if (!highlightOpen) {
      unlockScroll();
    }
  }, [highlightOpen]);
  

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (!highlightOpen) return;
  
      const target = e.target as Node;
  
      // ✅ If click is on highlight button, DO NOTHING (let toggle handle it)
      if (highlightButtonRef.current?.contains(target)) return;
  
      // ✅ If click inside highlight dropdown, DO NOTHING
      if (highlightRef.current?.contains(target)) return;
  
      // ✅ Otherwise close it
      setHighlightOpen(false);
    };
  
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [highlightOpen]);
  
  useEffect(() => {
    setLanguage(uiLanguage);
  }, [uiLanguage, verseRef]);
  

  useEffect(() => {
    if (activeTab !== "Compare") return;
  
    setLoading(true);
    loadCompare()
      .catch((e) => {
        console.error("Compare load failed", e);
        setCompareVerses([]);
      })
      .finally(() => setLoading(false));
  }, [activeTab, loadCompare]);

  
  useEffect(() => {
    if (activeTab !== "Interlinear") return;
    if (!scrollContainerRef.current) return;
  
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            // ⛔ Ignore observer during click-based scroll
            if (isProgrammaticScrollRef.current) return;
          
            const idxAttr = (e.target as HTMLElement).dataset.wordIndex;
            if (!idxAttr) return;
          
            const idx = Number(idxAttr);
            if (!Number.isNaN(idx)) {
              setActiveWordIndex(idx);
            }
          }
          
        }
      },
      {
        root: scrollContainerRef.current,
  
        // 🔑 Activation line = just below sticky header
        rootMargin: "0px 0px -30% 0px",

  
        // 🔑 Trigger when top edge crosses
        threshold: 0,
      }
    );
  
    wordRefs.current.forEach((el) => observer.observe(el));
  
    return () => observer.disconnect();
  }, [activeTab, interlinearRows]);
  
  

  
  // useEffect(() => {
  //   if (activeTab === "Summary" || activeTab === "Notes") {
  //     setAdvancedOpen(false);
  //   }
  // }, [activeTab]);
  
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
      } finally {
        setLoading(false);
      }
    })();
  }, [activeTab, loadTab]);
  
  
  useEffect(() => {
    if (activeTab === "Interlinear" && language === "TE") {
      setInterlinearNotice(
        "పదాల అనువాదం (Interlinear) ప్రస్తుతం ఆంగ్లంలో మాత్రమే అందుబాటులో ఉంది."
      );
    } else {
      setInterlinearNotice(null);
    }
  }, [activeTab, language]);
  
  
  
  
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
  
    setAnalysis({
      Summary: null,
      "Cross-references": null,
      "Historical Context": null,
    });
  
    setErrorMsg("");
  }, [verseRef]);
  
  


  useEffect(() => {
    const el = verseContainerRef.current;
    if (!el) return;
  
    // Get computed line-height
    const style = window.getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight);
  
    if (!lineHeight) return;
  
    const lines = Math.round(el.scrollHeight / lineHeight);
  
    // ✅ only treat as long if 5+ lines
    setIsLongVerse(lines >= 5);
  }, [displayVerseText, language]);
  
  
  

  useEffect(() => {
    if (!isAiTab(activeTab)) return;
  
    setAnalysis(prev => ({
      ...prev,
      [activeTab]: null,
    }));
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
  
      if (isAiTab(activeTab)) {
        setAnalysis(prev => ({
          ...prev,
          [activeTab]: text && text.trim() ? text : "__EMPTY__",
        }));
      }
      
      
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
                handleClickReference(
                  match.replace(/[—–:-]\s*$/, "")
                );
                
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleClickReference(
                  match.replace(/[.,;:—–)\]]\s*$/, "")
                );
                
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
            onClick={() => handleClickReference(normalizeRef(ref))}
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
  ? [{
      title: "Definition",
      bullets: cached.definition
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean),
    }]
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
        definition: (lex.meaning || "")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/?[^>]+>/g, "") // remove any other HTML
  .trim(),


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


  const effectiveHighlight =
  previewHighlight !== null
    ? previewHighlight
    : currentHighlight;

  /* -------------------------
    Render
  ---------------------------*/
  return (
<div
  className={`
    relative h-full flex flex-col
    p-4 md:p-5
    rounded-[1.75rem]
    overflow-hidden

    bg-gradient-to-br
    from-white via-slate-50 to-slate-100
    dark:from-slate-900 dark:via-slate-900 dark:to-slate-950

    border border-slate-200/70 dark:border-white/10

    shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)]
    dark:shadow-[0_10px_50px_-10px_rgba(0,0,0,0.7)]

    backdrop-blur-xl

    ${teluguClass}
  `}
>




      {/* HEADER */}
      <div
  className="
    -mx-4 md:-mx-5
    -mt-4 md:-mt-5
    mb-4

    px-5 py-4

    bg-gradient-to-r
    from-slate-900 via-slate-800 to-slate-900
    dark:from-black dark:via-slate-900 dark:to-black

    border-b border-white/10

    text-white

    shadow-sm
  "
>

  <div className="flex items-center justify-between">

        
    {/* Title */}
    <h2
  className={`
    text-[1.45rem]
    font-bold
    tracking-tight
    text-white
    drop-shadow-sm
    ${isTeluguUI ? "font-telugu" : ""}
  `}
>


      {language === "TE"
        ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
        : verseRef.book}{" "}
      <span className="text-blue-400 font-semibold">
  {" "}{verseRef.chapter}:{verseRef.verse}
</span>

    </h2>


    {/* Action buttons */}
    <div className="flex items-center gap-2 relative">

      {/* ✅ Highlight button beside ellipsis */}
      {onHighlightChange && (
  <div className="relative" ref={highlightRef}>

<button
  type="button"
  ref={highlightButtonRef}
  className={`
    relative
    w-10 h-10
    rounded-full

    flex items-center justify-center

    transition-all duration-200

    border

    ${
      effectiveHighlight
        ? `
          bg-gradient-to-br
          from-blue-500/90 to-indigo-600/90
          border-blue-400
          text-white
          shadow-md shadow-blue-500/30
        `
        : `
          bg-white/10
bg-white/10
border-white/10
text-white/80

hover:bg-white/20
hover:border-white/20
hover:text-white
        `
    }

    backdrop-blur-md

    hover:scale-[1.06]
    active:scale-[0.94]
  `}

  // ✅ Tap / desktop click
  onClick={() => {
    if (isLongPressActiveRef.current) return;
    setHighlightOpen(v => !v);
  }}

  // ✅ Start long-press detection
  onTouchStart={() => {
    touchMovedRef.current = false;
  
    longPressTimerRef.current = window.setTimeout(() => {
      if (touchMovedRef.current) return; // ❌ abort
      isLongPressActiveRef.current = true;
      pendingHighlightRef.current = null;
      setPreviewHighlight(null);
      lockScroll();
      setHighlightOpen(true);
    }, 350);
  }}
  
  

  // ✅ Track finger position (NO APPLY)
  onTouchMove={(e) => {
    if (!isLongPressActiveRef.current) {
      touchMovedRef.current = true;
      return;
    }
  
    const touch = e.touches[0];
    const el = document.elementFromPoint(
      touch.clientX,
      touch.clientY
    );
  
    if (!(el instanceof HTMLElement)) return;
  
    const color = el.dataset.highlightColor;
    if (color) {
      const resolved = color === "clear" ? null : color;
      pendingHighlightRef.current = resolved;
      setPreviewHighlight(resolved);
    }
  }}
  
  // ✅ Apply ONLY on release
  onTouchEnd={() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  
    if (isLongPressActiveRef.current && onHighlightChange) {
      onHighlightChange(pendingHighlightRef.current);
      unlockScroll();
      setHighlightOpen(false);
      onClose?.();
    }
  
    isLongPressActiveRef.current = false;
    pendingHighlightRef.current = null;
    setPreviewHighlight(null); // 🔑 cleanup
  }}
  
  
  
  onTouchCancel={() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  
    unlockScroll();
    isLongPressActiveRef.current = false;
    pendingHighlightRef.current = null;
    setHighlightOpen(false);
  }}
  
>
<>
  <i className="fas fa-highlighter text-[13px]" />

  {effectiveHighlight && (
    <span
      className={`
        absolute -bottom-0.5 -right-0.5
        w-3 h-3 rounded-full
        border border-white shadow-sm

        ${
          effectiveHighlight === "yellow"
            ? "bg-yellow-400"
            : effectiveHighlight === "green"
            ? "bg-green-400"
            : effectiveHighlight === "pink"
            ? "bg-rose-400"
            : "bg-sky-400"
        }
      `}
    />
  )}
</>

</button>


    {highlightOpen && (
      <div
      className="
      absolute right-0 mt-2 w-44
      
      bg-white dark:bg-slate-900
      
      border border-slate-200 dark:border-white/10
      
      rounded-2xl
      
      shadow-xl shadow-black/10 dark:shadow-black/40
      
      p-3 z-[9999]

      animate-in fade-in zoom-in-95 duration-150
      "      
      >
        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-2">
          {language === "TE" ? "హైలైట్" : "Highlight"}
        </p>

        <div className="flex items-center gap-2">
        <button
  type="button"
  data-highlight-color="yellow"
  onClick={() => {
    onHighlightChange("yellow");
    setHighlightOpen(false);
    onClose?.();
  }}
  className="w-7 h-7 rounded-full border border-slate-200 bg-yellow-300"
/>

<button
  type="button"
  data-highlight-color="green"
  onClick={() => {
    onHighlightChange("green");
    setHighlightOpen(false);
    onClose?.();
  }}
  className="w-7 h-7 rounded-full border border-slate-200 bg-green-300"
/>

<button
  type="button"
  data-highlight-color="pink"
  onClick={() => {
    onHighlightChange("pink");
    setHighlightOpen(false);
    onClose?.();
  }}
  className="w-7 h-7 rounded-full border border-slate-200 bg-rose-300"
/>

<button
  type="button"
  data-highlight-color="blue"
  onClick={() => {
    onHighlightChange("blue");
    setHighlightOpen(false);
    onClose?.();
  }}
  className="w-7 h-7 rounded-full border border-slate-200 bg-sky-300"
/>

        </div>

        <button
  type="button"
  data-highlight-color="clear"
  onClick={() => {
    onHighlightChange(null);
    setHighlightOpen(false);
    onClose?.();
  }}
          className="
            mt-3 w-full px-3 py-2 text-xs rounded-xl
            border border-slate-200 dark:border-white/10
            bg-slate-50 dark:bg-slate-800
            text-slate-700 dark:text-slate-200
            hover:bg-slate-100 dark:hover:bg-slate-700
            transition
          "
        >
          {language === "TE" ? "క్లియర్" : "Clear"}
        </button>
      </div>
    )}
  </div>
)}


      

      {/* Ellipsis Menu */}
      <div className="flex items-center gap-4">

  {/* Ellipsis Menu */}
  <div className="relative" ref={menuRef}>
  <button
    ref={menuButtonRef}
    onClick={() => setMenuOpen((v) => !v)}
    className="
    w-9 h-9
    rounded-full
  
    bg-white/10
    border border-white/10
  
    text-white/80
    hover:text-white
  
    hover:bg-white/20
    hover:border-white/20
  
    transition-all duration-200
  
    flex items-center justify-center
  "

  >

      <i className="fas fa-ellipsis-v" />
    </button>

    {menuOpen && (
      <div
  className={`
    absolute right-0 translate-x-[-8px] mt-2 min-w-[11rem]
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-700
    text-slate-800 dark:text-slate-200
    rounded-2xl shadow-2xl
    backdrop-blur-xl z-[9999]
    ${isTeluguUI ? "font-telugu" : ""}
  `}
>

    
        <button
          onClick={() => { handleCopyVerse(); setMenuOpen(false); }}
          className="w-full px-4 py-2 flex items-center gap-3 text-left 
          text-sm text-slate-700 dark:text-slate-200
          hover:bg-slate-100 dark:hover:bg-slate-800/60"
        >
          <i className="fas fa-copy w-4" />
          {L.copyVerse}

        </button>

        {activeTab !== "Notes" && (
  <button
    onClick={() => {
      handleCopyTabContent();
      setMenuOpen(false);
    }}
    className="w-full px-4 py-2 flex items-center gap-3 text-left
               text-sm hover:bg-slate-100 dark:hover:bg-slate-800/60"
  >
    <i className="fas fa-copy w-4" />
    {language === "TE"
  ? `${getTabLabel(activeTab, "TE")} కాపీ చేయి`
  : `Copy ${activeTab}`}


  </button>
)}


        <button
          onClick={() => { handleShareVerse(); setMenuOpen(false); }}
          className="w-full px-4 py-2 flex items-center gap-3 text-left 
          text-sm text-slate-700 dark:text-slate-200
          hover:bg-slate-100 dark:hover:bg-slate-800/60"
        >
          <i className="fas fa-share w-4" />
{L.shareVerse}

        </button>

        <button
  onClick={() => {
    setMenuOpen(false);
    handleShareAsImageClick();
  }}
  className="w-full px-4 py-2 flex items-center gap-3 text-left 
  text-sm text-slate-700 dark:text-slate-200
  hover:bg-slate-100 dark:hover:bg-slate-800/60"

>
<i className="fas fa-image w-4" />
{L.shareImage}

</button>


        <button
  onClick={() => {
    setMenuOpen(false);

    // Open ProfileNotes with incoming verse
    const displayBookName =
  language === "TE"
    ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
    : verseRef.book;

window.dispatchEvent(
  new CustomEvent("open-profile-notes", {
    detail: {
      ref: {
        ...verseRef,
        displayBook: displayBookName, // 👈 ADD THIS
      },
      text: displayVerseText,
    },
  })
);


    // ✅ CLOSE VerseTools (important for mobile UX)
    onClose?.();
  }}
  className="w-full px-4 py-2 flex items-center gap-3 text-left 
  text-sm text-slate-700 dark:text-slate-200
  hover:bg-slate-100 dark:hover:bg-slate-800/60"

>
<i className="fas fa-bookmark w-4" />
{L.addNotes}

</button>

        

<button
  onClick={() => {
    setLanguage(prev => (prev === "EN" ? "TE" : "EN"));
    setMenuOpen(false);
  }}
  className="w-full px-4 py-2 flex items-center gap-3 text-left
             text-sm hover:bg-slate-100 dark:hover:bg-slate-800/60"
>
  <i className="fas fa-globe w-4" />
  {L.language}: {language}
</button>

      </div>
    )}
  </div>

  {/* Close button */}
  {onClose && (
    <button
    onClick={onClose}
  className="
    w-9 h-9
    rounded-full

    bg-white/10
    hover:bg-white/20

    text-white/70 hover:text-white

    transition
    flex items-center justify-center
  "
>

      <i className="fas fa-times text-lg" />
    </button>
  )}
</div>

    </div>
  </div>
    {/* VERSE CARD */}
    <div
  className={`
    mt-3 mb-1
    rounded-2xl
    p-4
    transition-all duration-200

    border border-slate-200/70 dark:border-white/10

    shadow-[0_6px_20px_-6px_rgba(0,0,0,0.15)]
    dark:shadow-[0_6px_30px_-6px_rgba(0,0,0,0.6)]

    backdrop-blur-md

    ${
      effectiveHighlight === "yellow"
        ? "bg-yellow-100/80 dark:bg-yellow-600/25"
        : effectiveHighlight === "green"
        ? "bg-green-100/80 dark:bg-green-600/25"
        : effectiveHighlight === "pink"
        ? "bg-rose-100/80 dark:bg-rose-600/25"
        : effectiveHighlight === "blue"
        ? "bg-sky-100/80 dark:bg-sky-600/25"
        : "bg-white dark:bg-white/[0.05]"
    }
  `}
>



  {/* Verse Text */}
  <div
  ref={verseContainerRef}
  className={`
    relative overflow-hidden
    ${expanded || !isLongVerse ? "" : "max-h-[9.5rem]"}
  `}
>

<p
  className={`
    italic text-sm leading-relaxed
    text-slate-800 dark:text-slate-100
    ${isTeluguUI ? "font-telugu font-medium" : ""}
  `}
>

    {displayVerseText ? `"${displayVerseText}"` : ""}
  </p>

  {!expanded && isLongVerse && (
  <div
    className={`
      pointer-events-none
      absolute bottom-0 left-0 right-0
      h-4
      bg-gradient-to-t
      ${
        effectiveHighlight === "yellow"
          ? "from-yellow-100 dark:from-yellow-600/30"
          : effectiveHighlight === "green"
          ? "from-green-100 dark:from-green-600/30"
          : effectiveHighlight === "pink"
          ? "from-rose-100 dark:from-rose-600/30"
          : effectiveHighlight === "blue"
          ? "from-sky-100 dark:from-sky-600/30"
          : "from-white dark:from-slate-900"
      }
      to-transparent
    `}
  />
)}

</div>
{isLongVerse && (
  <div className="flex justify-end mt-1">
    <button
      onClick={() => setExpanded(v => !v)}
      className="
  text-xs font-medium
  text-slate-400 dark:text-slate-500
  hover:text-slate-500 dark:hover:text-slate-400
  no-underline
"

    >
      {expanded ? "Show less ▲" : "Read more ▼"}
    </button>
  </div>
)}


  </div>
</div>


    
      {/* Tabs */}
      <div
  className="
    mb-0
    -mx-4 md:-mx-5
    px-4 md:px-5

    bg-white
    dark:bg-slate-900/60

    backdrop-blur-xl

    border-b border-slate-200
    dark:border-white/10
  "
>

  {/* PRIMARY ROW */}
  <div
className="
border-b border-slate-200 dark:border-white/10

bg-white
dark:bg-white/[0.04]

backdrop-blur-xl
"

>

    <nav className="-mb-px flex items-center space-x-6">
      {PRIMARY_TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => {
            setActiveTab(tab);
            setAdvancedOpen(false); // 🔑 collapse advanced
            setErrorMsg("");
          }}
          className={`
            py-3 border-b-2 text-sm font-medium transition-all duration-200
            ${teluguClass}
            ${
              activeTab === tab
              ? "border-blue-400 text-blue-400 font-semibold"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"            
            }
          `}          
        >
          {getTabLabel(tab, language)}
        </button>
      ))}

      {/* ADVANCED TOGGLE */}
      <button
  onClick={() => setAdvancedOpen((v) => !v)}
  className={`py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 ${teluguClass}`}

>
  {ADVANCED_LABEL[language]} {advancedOpen ? "▴" : "▾"}
</button>

    </nav>
  </div>

  {/* ADVANCED ROW */}
  {advancedOpen && (
    <div
    className="
    border-b border-slate-200 dark:border-white/10

    bg-white
    dark:bg-white/[0.03]

    backdrop-blur-xl
  "
>

      <nav className="flex space-x-6 px-1">
        {ADVANCED_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setErrorMsg("");
            }}
            className={`
              py-2 text-sm border-b-2 transition-all duration-200
              ${teluguClass}
              ${
                activeTab === tab
                  ? "border-blue-500 text-blue-500 font-semibold"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
              }
              `}              
          >
            {getTabLabel(tab, language)}

          </button>
        ))}
      </nav>
    </div>
  )}
</div>





      {/* Main content */}
      <div
  ref={scrollContainerRef}
  className="
  flex-grow overflow-y-auto pr-2

  bg-white
  dark:bg-transparent

  backdrop-blur-xl


    scrollbar-thin
    scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700
    scrollbar-track-transparent
  "
>




{activeTab === "Notes" ? (
  <div className="flex flex-col gap-3">
    <textarea
      className={`
        w-full h-64 p-3
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-white/10
        rounded-2xl
        text-slate-900 dark:text-slate-100
        placeholder:text-slate-400
        focus:outline-none focus:ring-2 focus:ring-blue-500/30
        ${isTeluguUI ? "font-telugu" : ""}
      `}
      
    
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
      className="self-start px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:bg-blue-700 text-white rounded-md"
    >
      {language === "TE" ? "గమనిక సేవ్ చేయండి" : "Save Note"}
    </button>
  </div>
) : activeTab === "Compare" ? (
  loading ? (
    <LoadingSkeleton />
  ) : compareVerses.length === 0 ? (
    <p className="text-sm text-gray-500">
      Please check your network and try again.
    </p>
  ) : (
    <div className="space-y-4">
      {compareVerses.map(({ version, text }) => (
        <div
          key={version}
          className="
rounded-xl
p-4

bg-white/80 dark:bg-white/[0.04]

border border-slate-200/70 dark:border-white/10

shadow-[0_5px_20px_-5px_rgba(0,0,0,0.2)]
"
        >
          <div className="flex items-center gap-2 mb-1">
  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
    {VERSION_LABELS[version] || version.replace(/_/g, " ")}
  </span>

  <span className="
  px-2.5 py-0.5
  text-[10px]
  font-semibold
  rounded-full

  bg-slate-100
  text-slate-600

  dark:bg-slate-700
  dark:text-slate-300
">
  {version}
</span>

</div>


<p
  className={`text-sm leading-relaxed text-slate-800 dark:text-slate-200 ${
    version === "TELUGU_COMMUNITY_V1"? "font-telugu" : ""
  }`}
>

            {text}
          </p>
        </div>
      ))}
    </div>
  )
) : (
<div
  className={`
    prose prose-sm max-w-none font-sans
    text-slate-800 dark:text-slate-200
    dark:prose-invert
    ${isTeluguUI ? "font-telugu" : ""}
  `}
>


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
              p-3 bg-white dark:bg-slate-900
border border-slate-200 dark:border-white/10
rounded-2xl
shadow-sm

              space-y-2
            "
          >
          
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
const idx = getWordIndex(r);

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
const idx = getWordIndex(r);


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
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-2">
                    Transliteration
                  </p>
                  <p className="text-sm italic text-slate-600 dark:text-slate-300">
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
              const idx = getWordIndex(r);


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
data-word-index={idx}
key={`word-${idx}`}
ref={(el) => {
if (el) {
wordRefs.current.set(idx, el);
}
}}
className={`
rounded-2xl border px-4 py-3
border-slate-200 dark:border-white/10
transition-all duration-150
bg-white dark:bg-slate-900
shadow-sm
transition-colors
${
activeWordIndex === idx
? "border-blue-500/60 bg-blue-50/60 dark:bg-blue-900/20 ring-2 ring-blue-500/20"
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
<div className="text-sm font-serif text-slate-500 dark:text-slate-400">
{effectiveLemma || "—"}
</div>

{/* MEANING — PRIMARY CONTENT */}
<div className="mt-2 text-sm text-slate-800 dark:text-slate-200">
{effectiveMeaning || "—"}
</div>

{/* SECONDARY META ROW */}
<div className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
{effectiveTranslit && (
<span className="italic">{effectiveTranslit}</span>
)}

{row.strong && (
<button
onClick={() => openStrong(row)}
className="
  px-2 py-0.5 rounded
  border border-slate-300 dark:border-white/10
  hover:bg-slate-100 dark:hover:bg-slate-800
  text-slate-700 dark:text-slate-300
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
    ) : loading ? (
    <LoadingSkeleton />
  ) : isAiTab(activeTab) && analysis[activeTab] == null ? (

    <div className="flex flex-col items-start gap-3 text-sm text-slate-700 dark:text-slate-300 font-semibold dark:text-gray-300">
      <p>{getAiEmptyHintText(activeTab, language)}</p>
  
      <button
        onClick={handleGenerateClick}
        className="
        px-4 py-2
        rounded-xl
        
        bg-gradient-to-r
        from-blue-600
        via-indigo-600
        to-blue-700
        
        text-white
        text-sm font-medium
        
        shadow-lg shadow-blue-500/30
        hover:shadow-xl hover:shadow-blue-500/40
        
        hover:shadow-xl hover:shadow-blue-500/40
        hover:scale-[1.02]
        
        active:scale-[0.98]
        
        transition-all duration-200
        "        

      >
        {getAiActionText(activeTab, language)}
      </button>
    </div>
  ) : (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Process raw text nodes to make references clickable
          text({ children }) {
            // ReactMarkdown passes text as string, but handle all cases
            return <>{renderNodeWithRefs(children)}</>;
          },
          h1({ children }) {
            return (
              <h1 className="text-xl font-bold mt-4 mb-2">
                {renderNodeWithRefs(children)}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-lg font-bold mt-4 mb-2">
                {renderNodeWithRefs(children)}
              </h2>
            );
          },

          p({ children }) {
            // Let ReactMarkdown handle headings via # syntax
            // Don't auto-bold short paragraphs - too aggressive
            return <p>{renderNodeWithRefs(children)}</p>;
          },
          
          // Also handle list items
          li({ children }) {
            return <li>{renderNodeWithRefs(children)}</li>;
          }
          
        }}
      >
{isAiTab(activeTab) ? analysis[activeTab] ?? "" : ""}

      </ReactMarkdown>
    )}
  </div>
)}

      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9000]"
            onClick={() => setIsPreviewOpen(false)}
            style={{ pointerEvents: "auto" }}
          >
<div
  className="
    bg-white dark:bg-slate-900
    text-slate-900 dark:text-slate-200
    p-5 rounded-2xl shadow-2xl
    border border-slate-200 dark:border-white/10

    w-11/12 max-w-md 
    max-h-[75vh] 
    overflow-y-auto 
    overscroll-contain
  "
  onClick={(e) => e.stopPropagation()}
>

              <h3 className={`text-lg font-bold mb-2 text-slate-900 dark:text-white ${teluguClass}`}>
                {displayPreviewRef}
              </h3>

              <p
                className={`text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words ${
                  isTeluguUI ? "font-telugu" : ""
                }`}
              >
                {previewText || "Verse not found."}
              </p>

              <button
                className="
                mt-4 px-4 py-2 
                bg-blue-600 hover:bg-blue-500
                text-white 
                rounded-lg
                transition
                "                
                onClick={() => setIsPreviewOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* STEP 1 — Background / Gradient picker for image share */}
      {shareStep === "background" && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9000]"
            onClick={() => setShareStep(null)}
          >
            <div
              className="
                bg-white dark:bg-slate-900
                rounded-[1.75rem]
                shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)]
                w-11/12 max-w-2xl
                max-h-[85vh] overflow-y-auto
                p-7
              "
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="
                  -mx-7 -mt-7 mb-6
                  px-7 py-5
                  rounded-t-[1.75rem]
                  bg-gradient-to-b from-slate-900 to-slate-800
                  text-white
                  flex items-center justify-between
                "
              >
                <div>
                  <h3 className="text-sm font-semibold tracking-wide">
                    {language === "TE"
                      ? "వచనాన్ని అందంగా షేర్ చేయండి"
                      : "Share verse beautifully"}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    {language === "TE"
                      ? "బ్యాక్‌గ్రౌండ్ స్టయిల్ ఎంచుకోండి"
                      : "Choose a background style"}
                  </p>
                </div>

                <button
                  onClick={() => setShareStep(null)}
                  className="
                  w-9 h-9
                  rounded-full
              
                  bg-white/10
                  border border-white/10
              
                  text-white/80
                  hover:text-white
              
                  hover:bg-white/20
                  hover:border-white/20
              
                  transition-all duration-200
              
                  flex items-center justify-center
                "              
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Background choices */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5 mb-6">
                {/* Gradient option card */}
                <button
                  onClick={() => {
                    setSelectedBackground(null);
                    const first = GRADIENT_PRESETS[0];
                    setSelectedGradient(first);
                    // scroll to gradient picker section
                    setTimeout(() => {
                      if (gradientSectionRef.current) {
                        gradientSectionRef.current.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }
                    }, 0);
                  }}
                  className={`
                    relative aspect-square rounded-xl overflow-hidden border-2 transition-all
                    ${
                      selectedBackground === null
                        ? "border-blue-600 ring-2 ring-blue-300"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }
                  `}
                >
                  <div
                    className="
                      absolute inset-0
                      bg-gradient-to-br
                      from-indigo-400 via-sky-300 to-blue-500
                      dark:from-indigo-600 dark:via-sky-500 dark:to-blue-700
                    "
                  />
                  <div
                    className="
                      absolute inset-0
                      bg-gradient-to-t
                      from-black/25 via-transparent to-white/20
                    "
                  />
                  <div
                    className="
                      absolute inset-0
                      opacity-[0.08]
                      bg-[url('/noise.png')]
                    "
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-palette text-2xl text-white/80" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm text-white text-xs py-1.5 text-center font-semibold tracking-wide">
                    Gradient
                  </div>
                </button>

                {/* Image options */}
                {NATURE_BACKGROUNDS.map((bg) => (
                  <button
  key={bg.id}
  onClick={() => {
    setSelectedBackground(bg.url);
    setSelectedGradient(null);
    setShareStep("content");
  }}
  className="
    relative aspect-square w-full
    rounded-2xl overflow-hidden
    border border-slate-200 dark:border-slate-700
    hover:scale-[1.03] hover:shadow-lg
    transition
  "
>
<img
  src={bg.url}
  className="w-full h-full object-cover object-center"
  alt={bg.name}
/>
                    <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] py-1 text-center px-1 truncate">
                      {bg.name}
                    </div>
                  </button>
                ))}
              </div>

              {/* Gradient presets row (only when using gradient) */}
              <div ref={gradientSectionRef} className="mt-2">
              {demoBanner && (
  <div
    className="
      mb-4
      rounded-xl
      border
      border-blue-200
      bg-blue-50
      dark:bg-blue-900/20
      dark:border-blue-700
      p-3
    "
  >
    <div className="font-semibold text-sm">
      ✨ Step 1 of 2
    </div>

    <div className="text-xs mt-1">
      Choose any background to create your verse image.
    </div>
  </div>
)}
                <p className="text-xs font-semibold mb-2 text-slate-600 dark:text-slate-300">
                  {language === "TE"
                    ? "గ్రాడియెంట్ రంగులు"
                    : "Gradient colors"}
                </p>
                <div className="overflow-x-auto overflow-y-hidden pb-2">
                  <div className="flex gap-3 flex-nowrap">
                    {GRADIENT_PRESETS.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => {
                          setSelectedBackground(null);
                          setSelectedGradient({ from: g.from, to: g.to });
                          setShareStep("content");
                        }}
                        className={`
                          w-14 h-14
                          rounded-xl
                          flex-shrink-0
                          border
                          ${
                            selectedGradient &&
                            selectedGradient.from === g.from &&
                            selectedGradient.to === g.to
                              ? "border-blue-500 ring-2 ring-blue-400/60"
                              : "border-slate-300 dark:border-slate-700"
                          }
                        `}
                        style={{
                          background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShareStep(null)}
                className="
                  mt-6 w-full
                  py-3 rounded-xl
                  text-sm font-semibold
                  text-slate-700 dark:text-slate-200
                  bg-slate-100 dark:bg-slate-800
                  border border-slate-200 dark:border-slate-700
                  hover:bg-slate-200 dark:hover:bg-slate-700
                  transition
                "
              >
                {language === "TE" ? "రద్దు" : "Cancel"}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* STEP 2 — Verse image preview / share */}
      {shareStep === "content" && (
  <ModalPortal>
    <div
      className="fixed inset-0 bg-black/50 z-[9000] flex items-center justify-center"
      onClick={() => {
        setShareStep(null);
        window.dispatchEvent(
          new CustomEvent("demo-behind-modal", { detail: false })
        );
      }}
    >
      <VerseImageShare
        verseRef={verseRef}
        verseText={
          shareVerses.length
              ? shareVerses
              : [displayVerseText]
      }
        language={language}
        layout={shareLayout}   // keep this
        setLayout={setShareLayout}
        backgroundUrl={selectedBackground}
        gradient={selectedGradient}
        onClose={() => {
          setShareStep(null);
          window.dispatchEvent(
            new CustomEvent("demo-behind-modal", { detail: false })
          );
        }}
        onBack={() => setShareStep("background")}
      />
    </div>
  </ModalPortal>
)}

      {strongPopup && (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/50 flex items-end z-[9000]"
        onClick={() => {
          setStrongPopup(null);
          setShowFullLexicon(false);
        }}
      >
        <div
          className="bg-white dark:bg-slate-900 w-full rounded-t-xl p-4 max-h-[70vh] overflow-y-auto text-slate-800 dark:text-slate-200"
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
  <p className="text-sm text-slate-800 dark:text-slate-200">
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
    <ul className="list-disc ml-5 text-sm text-slate-700 dark:text-slate-300">
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