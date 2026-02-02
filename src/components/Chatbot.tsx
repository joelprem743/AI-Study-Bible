// src/components/Chatbot.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  Message,
  GroundingChunk,
  Verse,
  VerseReference,
  ChatbotAnswer,
} from "..";

import { sendMessageToLlama } from "../services/geminiService";


import ModalPortal from "./ModalPortal";
import { findBookMetadata, fetchChapter } from "../services/bibleService";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";





// Helper translations (simple conversational Telugu)
const UI_TEXT = {
  welcome_en: `👋 Hello! I'm Study  Companion — your AI-powered Bible study assistant 📖✨`,
  welcome_te: `👋 హలో! నేనే స్టడీ కంపానియన్ — మీ AI ఆధారిత బైబిల్ అధ్యయన సహాయకుడు 📖✨`,

  tryQuestions_en: `Try questions like:`,
  tryQuestions_te: `ఈ తరహా ప్రశ్నలను ప్రయత్నించండి:`,

  followUpHeading_en: `Try more questions like:`,
  followUpHeading_te: `ఇంకా ఈ తరహా ప్రశ్నలు ప్రయత్నించండి:`,

  placeholder_en: `Ask a theological question...`,
  placeholder_te: `బైబిల్‌కు సంబంధించిన ప్రశ్న అడగండి...`,

  send_en: `Send`,
  send_te: `పంపండి`,
};




// BOT MESSAGE COMPONENT (PREMIUM)
const BotMessage: React.FC<{
  answer: ChatbotAnswer;
  sources?: GroundingChunk[];
  renderWithRefs: (node: React.ReactNode) => React.ReactNode;
  onReferenceClick: (ref: string) => void;
}> = ({ answer, sources, renderWithRefs, onReferenceClick }) => {
  const [openSections, setOpenSections] = React.useState<Record<number, boolean>>(
    () =>
      answer.sections.reduce((acc, _, idx) => {
        acc[idx] = idx === 0;
        return acc;
      }, {} as Record<number, boolean>)
  );

  const toggle = (i: number) =>
    setOpenSections((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="flex items-start gap-2.5">
      {/* Bot identity */}
      <div className="shrink-0 mt-1">
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shadow-inner">
          BC
        </div>
      </div>

      {/* Bot bubble */}
      <div className="flex flex-col w-full max-w-[92%] p-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-[1.25rem] rounded-tl-none shadow-md border border-slate-100 dark:border-slate-700">
      {answer.sections.map((sec, i) => (
        <div 
            key={`${sec.heading || "section"}-${i}`}
            className="mb-3 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50/60 dark:bg-slate-900/40"
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <span className="font-semibold text-[13px] text-slate-900 dark:text-white">
  {sec.heading}
</span>

              <span className="text-xs opacity-70">
                {openSections[i] ? "−" : "+"}
              </span>
            </button>

            {openSections[i] && (
              <div className="p-4 space-y-3">
<div className="text-[13px] leading-relaxed whitespace-pre-wrap">
  {renderWithRefs(sec.content)}
</div>

{sec.scriptures.length > 0 && (
  <div>
    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
      Scriptures
    </div>

    <div className="flex flex-wrap gap-2">
      {sec.scriptures.map((ref, j) => (
        <button
          key={j}
          onClick={() => onReferenceClick(ref)}
          className="text-[11px] px-3 py-1 rounded-full border"
        >
          {ref}
        </button>
      ))}
    </div>
  </div>
)}

              </div>
            )}
          </div>
        ))}

        {/* Sources */}
        {sources?.length > 0 && (
          <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-[11px] font-semibold mb-2 text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Sources
            </h4>

            <ul className="space-y-1">
              {sources.map((s, i) => (
                <li key={i} className="text-[12px]">
                  <a
                    href={s.web?.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-words"
                  >
                    {s.web?.title || s.web?.uri}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};


const BotTyping: React.FC = () => {
  return (
    <div className="flex items-start gap-2.5">
      {/* Bot identity */}
      <div className="shrink-0 mt-1">
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shadow-inner">
          BC
        </div>
      </div>

      {/* Typing bubble */}
      <div className="flex flex-col w-full max-w-[92%] p-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-[1.25rem] rounded-tl-none shadow-md border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:120ms]"></div>
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:240ms]"></div>
          </div>
          <span className="text-[12px] text-slate-500 dark:text-slate-400">
            Thinking...
          </span>
        </div>
      </div>
    </div>
  );
};


// USER MESSAGE COMPONENT
// USER MESSAGE COMPONENT (PREMIUM)
const UserMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start justify-end gap-2.5">
    <div className="flex flex-col w-full max-w-[92%] p-4 bg-slate-900 text-white rounded-[1.25rem] rounded-tr-none shadow-xl border border-slate-800">
      <p className="text-[13px] leading-relaxed">{message}</p>
    </div>
  </div>
);


const INLINE_REF_RENDER_REGEX = new RegExp(
  `((?:[1-3]?\\s*)?(?:[A-Za-z\\.]+|[\\u0C00-\\u0C7F]+(?:\\s+[\\u0C00-\\u0C7F]+)*)\\s+\\d+:\\d+(?:-\\d+)?)`,
  "gu"
);




// MAIN CHATBOT COMPONENT
interface ChatbotProps {
  selectedBook: string;
  selectedChapter: number;
  selectedVerseRef: VerseReference | null;
  verses: Verse[];
  studyMode: "single" | "parallel";
  singleVersion: string;
  isOpen: boolean;
  onToggle: () => void;

  initialMessage?: string | null;

  // ✅ NEW: force chatbot language when opening from WelcomeScreen
  initialLanguage?: "EN" | "TE" | null;
  onInitialMessageConsumed?: () => void;
}



type ChatScope = "GLOBAL" | "VERSE" | "CHAPTER";

export const Chatbot: React.FC<ChatbotProps> = ({
  selectedBook,
  selectedChapter,
  selectedVerseRef,
  verses,
  studyMode,
  singleVersion,
  isOpen,
  onToggle,
  initialMessage,
  initialLanguage,
  onInitialMessageConsumed,
}) => {



  // UI language (controls UI strings, suggestions)
  const [language, setLanguage] = useState<"EN" | "TE">("EN");

  // modelLanguage controls the language instruction sent to the AI.
  // This enables Option B: keep chat history, but all future AI responses follow modelLanguage.
  const [modelLanguage, setModelLanguage] = useState<"EN" | "TE">("EN");


const [chatScope, setChatScope] = useState<ChatScope>("GLOBAL");

  // const [chatMode, setChatMode] = useState<ChatMode>(ChatMode.FAST);

  const [previewRef, setPreviewRef] = useState<string | null>(null);
const [previewText, setPreviewText] = useState<string>("");
const [isPreviewOpen, setIsPreviewOpen] = useState(false);

const [answerDepth, setAnswerDepth] = useState<
"SHORT" | "MEDIUM" | "DEEP"
>("MEDIUM");


  const [messages, setMessages] = useState<Message[]>([]);
  const [followUpQs, setFollowUpQs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const messagesRef = useRef<Message[]>([]);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const lastAutoSentRef = useRef<string | null>(null);
  const modelLanguageRef = useRef<"EN" | "TE">("EN");
const languageRef = useRef<"EN" | "TE">("EN");

useEffect(() => {
  messagesRef.current = messages;
}, [messages]);


useEffect(() => {
  modelLanguageRef.current = modelLanguage;
}, [modelLanguage]);

useEffect(() => {
  languageRef.current = language;
}, [language]);


  // Detect initial chatbot language from current Bible version
// const detectInitialLanguage = (): "EN" | "TE" => {
//   return englishVersion === "TELUGU_COMMUNITY_V1" ? "TE" : "EN";
// };


  // const CHAT_MODE_LABELS = {
  //   [ChatMode.FAST]: language === "TE" ? "ఫాస్ట్" : "Fast",
  //   [ChatMode.STANDARD]: language === "TE" ? "స్టాండర్డ్" : "Standard",
  //   [ChatMode.DEEP_THOUGHT]: language === "TE" ? "డీప్ థాట్" : "Deep Thought",
  // } as Record<ChatMode, string>;

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages, followUpQs]);

  useEffect(() => {
    if (!isOpen) return;
  
    const handleClickOutside = (e: MouseEvent) => {
      // ✅ If verse preview modal is open, never close chatbot by outside click
      if (isPreviewOpen) return;
  
      const target = e.target as Node;
  
      if (
        chatRef.current &&
        !chatRef.current.contains(target) &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(target)
      ) {
        onToggle();
      }
    };
  
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle, isPreviewOpen]);
  

  useEffect(() => {
    if (!isPreviewOpen) return;
  
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  
    return () => {
      document.body.style.overflow = original;
    };
  }, [isPreviewOpen]);
  

  useEffect(() => {
    if (!isModeDropdownOpen) return;
  
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
  
      if (
        controlsRef.current &&
        !controlsRef.current.contains(target)
      ) {
        setIsModeDropdownOpen(false);
      }
    };
  
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isModeDropdownOpen]);
  

  useEffect(() => {
    if (!isOpen) return;
    if (!initialMessage) return;
  
    if (lastAutoSentRef.current === initialMessage) return;
    lastAutoSentRef.current = initialMessage;
  
    // ✅ Set best scope
    if (selectedVerseRef) {
      setChatScope("VERSE");
    }
  
    // ✅ Apply language BEFORE sending
    if (initialLanguage === "TE" || initialLanguage === "EN") {
      setLanguage(initialLanguage);
      setModelLanguage(initialLanguage);
      languageRef.current = initialLanguage;
      modelLanguageRef.current = initialLanguage;

    }
  
    // ✅ Send after state update (next tick)
    setTimeout(() => {
      handleSend(initialMessage);
      onInitialMessageConsumed?.(); // ✅ critical
    }, 0);
    
  }, [isOpen, initialMessage, selectedVerseRef, initialLanguage, onInitialMessageConsumed]);
  
  

  useEffect(() => {
    if (!isOpen) return;
  
    // ✅ While initialMessage exists, DON'T override language here.
    // Auto-send effect owns language syncing.
    if (initialMessage) return;

    if (initialLanguage === "TE" || initialLanguage === "EN") {
      setLanguage(initialLanguage);
      setModelLanguage(initialLanguage);
      setFollowUpQs([]);
      return;
    }

    const lang =
      studyMode === "single" && singleVersion === "TELUGU_COMMUNITY_V1"
        ? "TE"
        : "EN";

    setLanguage(lang);
    setModelLanguage(lang);
    setFollowUpQs([]);
  }, [isOpen, studyMode, singleVersion, initialLanguage, initialMessage]);

  

  useEffect(() => {
    const handler = (e: any) => {
      // ❌ Never stream when structured JSON is expected

    };
  
    window.addEventListener("llama-stream", handler);
    return () => window.removeEventListener("llama-stream", handler);
  }, [isLoading]);
  
  // Translation helper for UI text
  const t = (key: string) => {
    if (language === "TE") return (UI_TEXT as any)[`${key}_te`] || (UI_TEXT as any)[`${key}_en`];
    return (UI_TEXT as any)[`${key}_en`];
  };

  // Default suggestions (UI-language aware)
  const generateDefaultSuggestions = () => {
    if (language === "TE") {
      if (selectedVerseRef) {
        return [
          `ఈ వచనం ${selectedVerseRef.book} ${selectedVerseRef.chapter}:${selectedVerseRef.verse} యొక్క ప్రధాన అంశం ఏమిటి?`,
          `ఈ వచనం నా రోజువారీ జీవితంలో ఎలా వర్తింపచేస్తాను?`,
          `ఈ వచనాన్ని క్రాస్-రెఫరెన్సుల తో వివరిస్తే ఎలా అవుతుంది?`,
        ];
      }

      if (selectedBook && selectedChapter) {
        return [
          `${selectedBook} ${selectedChapter} యొక్క ప్రధాన అంశం ఏమిటి?`,
          `${selectedBook} ${selectedChapter} ను సంక్షిప్తంగా వివరించండి.`,
          `${selectedBook} ${selectedChapter} ఎందుకు ముఖ్యమైనది?`,
        ];
      }

      return [
        `బైబిల్ యొక్క ప్రధాన సందేశం ఏమిటి?`,
        `పాత ప్రభుత్వం మరియు కొత్త ప్రభుత్వం ఎలా సంబంధించాయి?`,
        `ప్రధాన అంశాలు ఏమిటి?`,
      ];
    }

    // English defaults
    if (selectedVerseRef) {
      return [
        `What is the meaning of ${selectedVerseRef.book} ${selectedVerseRef.chapter}:${selectedVerseRef.verse}?`,
        `How can I apply this verse in my daily life?`,
        `Explain this verse using cross-references from the Bible.`,
      ];
    }

    if (selectedBook && selectedChapter) {
      return [
        `What is the main theme of ${selectedBook} chapter ${selectedChapter}?`,
        `Give me a summary of ${selectedBook} ${selectedChapter}.`,
        `Why is ${selectedBook} chapter ${selectedChapter} important?`,
      ];
    }

    return [
      `What is the main message of the Bible?`,
      `How do the Old and New Testaments connect?`,
      `What are the major themes in Scripture?`,
    ];
  };

  const extractJsonFromSentinel = (text: string): string => {
    const match = text.match(/<json>([\s\S]*?)<\/json>/i);
    if (!match) return "";
    return match[1].trim();
  };
  
  const effectiveEnglishVersion = (() => {
    // Telugu single mode still needs English fallback for logic
    if (studyMode === "single" && singleVersion === "TELUGU_COMMUNITY_V1") {
      return "KJV";
    }
  
    return singleVersion;
  })();
  
  // ===== Robust JSON Helpers (Follow-ups) =====

// 1) Strip illegal control chars that can crash JSON.parse
const stripIllegalControlChars = (s: string) => {
  // Remove ASCII control chars except \n and \t (keep readable text)
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
};

// 2) Try to extract JSON from <json>...</json> or fallback to first {...} block
const extractBestJsonCandidate = (raw: string): string => {
  // prefer <json> sentinel
  const sentinel = raw.match(/<json>([\s\S]*?)<\/json>/i);
  if (sentinel?.[1]) return sentinel[1].trim();

  // fallback: try first object-like block
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return "";
};

// 3) Best-effort JSON repair (minimal, safe-ish)
const tryRepairJson = (jsonText: string) => {
  let s = jsonText;

  // remove BOM
  s = s.replace(/^\uFEFF/, "");

  // strip illegal control chars
  s = stripIllegalControlChars(s);

  // remove trailing commas:  {"a":[1,2,],}  -> {"a":[1,2]}
  s = s.replace(/,\s*([}\]])/g, "$1");

  return s.trim();
};

// 4) Safe parse wrapper
const safeJsonParse = <T,>(raw: string): { ok: true; value: T } | { ok: false; error: any } => {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (err) {
    return { ok: false, error: err };
  }
};

// 5) Fallback question extraction when JSON is garbage
const fallbackExtractQuestions = (raw: string): string[] => {
  const cleaned = raw
    .replace(/<json>/gi, "")
    .replace(/<\/json>/gi, "")
    .trim();

  // try to capture anything inside quotes after "questions": [...]
  const quoted = Array.from(cleaned.matchAll(/"([^"]+)"/g))
    .map(m => m[1])
    .map(q => q.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // If model included schema, quoted will include "questions" as a word. Remove it.
  const filtered = quoted.filter(q => q.toLowerCase() !== "questions");

  // Hard cap to 3
  return filtered.slice(0, 3);
};

// 6) Normalize final questions
const normalizeQuestions = (qs: string[]) => {
  return qs
    .map(q => String(q))
    .map(q => q.replace(/\s+/g, " ").trim())
    .map(q => q.replace(/^(\d+[\).\s-]+)/, "")) // remove "1) " or "2. "
    .filter(Boolean)
    .slice(0, 3);
};

  // Follow-up generation: uses modelLanguage (ensures future follow-ups match selected model language)
  const generateAIFollowUps = async (
    answerJson: ChatbotAnswer,
    history: Message[]
  ): Promise<string[]> => {
    const currentModelLang = modelLanguageRef.current;
  
    const langInstruction =
      currentModelLang === "TE"
        ? "ప్రశ్నలు పూర్తిగా తెలుగులో మాత్రమే ఇవ్వండి. ఇంగ్లీష్ వద్దు."
        : "Return questions in English only.";
  
    const prompt = `
  You are generating FOLLOW-UP QUESTIONS only.
  
  Return EXACTLY this format and NOTHING else:
  
  <json>
  {
    "questions": [
      "question 1",
      "question 2",
      "question 3"
    ]
  }
  </json>
  
  Rules:
  - Exactly 3 questions
  - Each question MUST be a single line (no line breaks)
  - Plain text only
  - No markdown
  - No headings
  - No explanations
  - No Bible verses quoted
  - No bullet symbols
  - Do NOT include numbering like "1)" or "Q1"
  - Escape any newline inside strings as \\n
  
  Base them on these section headings:
  ${answerJson.sections.map(s => `- ${s.heading}`).join("\n")}

  
  ${langInstruction}
  `;
  
    let resultText = "";
  
    try {
      const result = await sendMessageToLlama(prompt, history, currentModelLang);
      resultText = result.text || "";
    } catch {
      return [];
    }
  
    // ✅ Step 1: extract best JSON candidate
    const candidateRaw = extractBestJsonCandidate(resultText);
    if (!candidateRaw) {
      // no JSON found: fallback
      return normalizeQuestions(fallbackExtractQuestions(resultText));
    }
  
    // ✅ Step 2: attempt parse as-is
    const direct = safeJsonParse<{ questions?: any }>(candidateRaw);
    if (direct.ok && Array.isArray(direct.value?.questions)) {
      return normalizeQuestions(direct.value.questions);
    }
  
    // ✅ Step 3: repair and parse again
    const repaired = tryRepairJson(candidateRaw);
    const repairedParse = safeJsonParse<{ questions?: any }>(repaired);
  
    if (repairedParse.ok && Array.isArray(repairedParse.value?.questions)) {
      return normalizeQuestions(repairedParse.value.questions);
    }
  
    // ✅ Step 4: fallback extraction if still broken
    return normalizeQuestions(fallbackExtractQuestions(resultText));
  };
  
  

  // ===== JSON SENTINEL HELPERS =====



  const loadReferenceText = async (refStringRaw: string) => {
    try {
      const refString = refStringRaw
        .replace(/[–—]/g, "-")
        .replace(/\(.*?\)/g, "")
        .trim();
  
      const m = refString.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
      if (!m) return "";
  
      const rawBook = m[1].trim();
      const chapter = Number(m[2]);
      const startVerse = Number(m[3]);
      const endVerse = m[4] ? Number(m[4]) : startVerse;
  
      let meta = findBookMetadata(rawBook);
  
      if (!meta) {
        const eng = Object.entries(TELUGU_BOOK_NAMES).find(
          ([, tel]) => tel === rawBook
        );
        if (eng) meta = findBookMetadata(eng[0]);
      }
  
      if (!meta) return "";
  
      const version =
  languageRef.current === "TE"
    ? "TELUGU_COMMUNITY_V1"
    : effectiveEnglishVersion;

  
      const chapterData = await fetchChapter(meta.name, chapter, version);
      if (!chapterData?.length) return "";
  
      return chapterData
        .filter(v => v.verse >= startVerse && v.verse <= endVerse)
        .map(v => v.text[version] ?? "")
        .filter(Boolean)
        .join("\n");
    } catch {
      return "";
    }
  };
  

  const normalizeText = (text: string) => {
    return text
      // Remove markdown headers and emphasis
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/`+/g, "")
  
      // Normalize bullet points: force each onto a new line
      .replace(/\s*\*\s+/g, "\n• ")
  
      // Force known section labels onto new paragraphs
      .replace(
        /\b(Summary of John \d+|Summary|Key Points|Important Verses|Bible References|Conclusion)\b/g,
        "\n\n$1"
      )
  
      // Clean up excessive whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };
  
  const handleClickReference = async (reference: string) => {
    const meta = findBookMetadata(reference.split(/\s+\d+:/)[0]);
    if (!meta) return; // ignore garbage matches
  
    setPreviewRef(reference);
    const text = await loadReferenceText(reference);
    setPreviewText(text);
    setIsPreviewOpen(true);
  };

  const renderNodeWithRefs = (node: React.ReactNode): React.ReactNode => {
  if (node == null) return null;

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
          key={`${match}-${start}`}
          className="text-blue-600 dark:text-blue-400 underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            handleClickReference(match);
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

  if (Array.isArray(node)) {
    return node.map((c, i) => (
      <React.Fragment key={i}>
        {renderNodeWithRefs(c)}
      </React.Fragment>
    ));
  }

  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  
    return React.cloneElement(
      element,
      element.props,
      renderNodeWithRefs(element.props.children)
    );
  }
  

  return node;
};

const extractJsonObject = (text: string): string => {
  const jsonText = extractJsonFromSentinel(text);
  if (!jsonText) {
    throw new Error("No <json>...</json> block found in AI response");
  }
  return jsonText;
};





const buildContextualInput = (input: string) => {
  const currentModelLang = modelLanguageRef.current;
  const currentUILang = languageRef.current;

  if (chatScope === "VERSE" && selectedVerseRef) {
    const verseData = verses.find(v => v.verse === selectedVerseRef.verse);

    const verseText =
      currentUILang === "TE"
        ? verseData?.text.TELUGU_COMMUNITY_V1
        : verseData?.text[effectiveEnglishVersion];

    return verseText
      ? `${
          currentModelLang === "TE"
            ? "ఈ వచన సందర్భంలో మాత్రమే సమాధానం ఇవ్వండి:"
            : "Answer strictly in the context of"
        } ${selectedVerseRef.book} ${selectedVerseRef.chapter}:${selectedVerseRef.verse} (${verseText}): ${input}`
      : `Answer in the context of ${selectedVerseRef.book} ${selectedVerseRef.chapter}:${selectedVerseRef.verse}: ${input}`;
  }

  if (chatScope === "CHAPTER" && selectedBook && selectedChapter) {
    return currentModelLang === "TE"
      ? `${selectedBook} ${selectedChapter} అధ్యాయం సందర్భంలో సమాధానం ఇవ్వండి: ${input}`
      : `Answer in the context of ${selectedBook} chapter ${selectedChapter}: ${input}`;
  }
  

  return input;
};






  // SEND MESSAGE
  const handleSend = async (forcedInput?: string) => {
    if (isLoading) return;
    // clear old follow-ups (they belong to previous bot answer)
    setFollowUpQs([]);

    const finalInput = forcedInput ?? input.trim();
if (!finalInput || isLoading) return;

const currentModelLang = modelLanguageRef.current;
const currentUILang = languageRef.current;

// STEP 3: detect direct question

const getFormattingRules = (depth: "SHORT" | "MEDIUM" | "DEEP") => {
  const isTelugu = currentModelLang === "TE";

  const sectionRules =
    depth === "SHORT"
      ? "2 sections, concise, devotional"
      : depth === "MEDIUM"
      ? "3 sections, clear teaching flow"
      : "Up to 4 sections, deep insight without padding";

  return `
SYSTEM INSTRUCTION (CRITICAL):

${isTelugu ? "మీరు బైబిల్ ఉపాధ్యాయుడు." : "You are a Bible teacher."}

Return ONE valid JSON object.
No markdown.
No emojis.
Plain text only.
Bullet points using "-" or "•" are ALLOWED.
Use line breaks for readability.


REQUIRED SCHEMA:
{
  "sections": [
    {
      "heading": string,
      "content": string,
      "scriptures": string[]
    }
  ]
}

RULES:
- ${sectionRules}
- Each section explains ONE idea
- Scriptures must SUPPORT the content
- No verse dumping
- No repetition
- Natural paragraph flow
- ${isTelugu ? "పూర్తిగా తెలుగులో మాత్రమే ఇవ్వండి." : "English only."}

Return JSON wrapped EXACTLY like this:

<json>
{ ... }
</json>

DO NOT output anything outside <json>.
`;
};

const userMessage: Message = {
  id: crypto.randomUUID(),
  text: finalInput,
  sender: "user",
};


    setMessages(prev => [...prev, userMessage].slice(-50));
    setInput("");
    setIsLoading(true);


    const contextualizedInput = buildContextualInput(finalInput);


    // Use modelLanguage for AI instruction (this guarantees Option B)
    const langInstruction = currentModelLang === "TE" ? "సమాధానం తెలుగులో ఇవ్వండి." : "Answer in English.";
    try {
      const response = await sendMessageToLlama(
        `${contextualizedInput}
      


${langInstruction}

${getFormattingRules(answerDepth)}

      `,
      [...messagesRef.current, userMessage],
        currentModelLang,
        answerDepth
      );
      
      
      let parsed: ChatbotAnswer;

try {
  const jsonText = extractJsonObject(response.text);
  parsed = JSON.parse(jsonText);
} catch {
  // 🔁 AUTO-RECOVERY FALLBACK
  parsed = {
    sections: [
      {
        heading: currentModelLang === "TE" ? "వివరణ" : "Explanation",
        content: normalizeText(response.text),
        scriptures: []
      }
    ]
  };
  
}

parsed.sections = Array.isArray(parsed.sections)
  ? parsed.sections
  : [
      {
        heading: currentModelLang === "TE" ? "వివరణ" : "Explanation",
        content: normalizeText(response.text),
        scriptures: [],
      },
    ];


    parsed.sections = parsed.sections.map(sec => ({
      heading: typeof sec.heading === "string" ? sec.heading.trim() : "",
      content: typeof sec.content === "string" ? sec.content.trim() : "",
      scriptures: Array.isArray(sec.scriptures) ? sec.scriptures : [],
    }));
    

    const botMessage: Message = {
      id: crypto.randomUUID(),
      sender: "bot",
      answer: parsed,
      sources: response.sources,
    };
    

      

    setMessages(prev => [...prev, botMessage].slice(-50));


      // generate follow-ups using the same model language
      try {
        const aiQs = await generateAIFollowUps(
          parsed,
          [...messagesRef.current.filter(m => m.sender === "user"), userMessage]
        );
        
        setFollowUpQs(aiQs);
      } catch (err) {
        console.warn("Follow-up skipped:", err);
        setFollowUpQs([]);
      }
    } catch (err: any) {
      console.error("Chatbot error:", err);

      const fallback =
        err?.error?.code === 503 || err?.status === "UNAVAILABLE"
          ? currentModelLang === "TE"
            ? "AI మోడల్ ఓవరోడెడ్ అయ్యింది. దయచేసి మోడల్ మార్చండి."
            : "The AI model is overloaded. Try switching models."
          : currentModelLang === "TE"
          ? "ఏదో తప్పిపోయింది. దయచేసి మళ్లీ ప్రయత్నించండి."
          : "Something went wrong. Please try again.";

          const errorMessage: Message = {
            id: crypto.randomUUID(),
            text: fallback,
            sender: "bot",
          };
          

          setMessages(prev => [...prev, errorMessage].slice(-50));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (question: string) => {
    handleSend(question);
  };

  // When user switches UI language, we update both UI language and modelLanguage depending on intent.
  // For Option B we set modelLanguage immediately to the new choice so all future responses follow.
  const handleLanguageSelect = (newLang: "EN" | "TE") => {
    setLanguage(newLang);
    setModelLanguage(newLang);
  
    // ✅ force immediate sync for next send
    languageRef.current = newLang;
    modelLanguageRef.current = newLang;
  
    setFollowUpQs([]);
  };
  

  return (
    <>
      {/* FLOAT BUTTON */}
      <button
  ref={toggleButtonRef}
  onClick={onToggle}

        className="
          fixed bottom-5 right-5 w-16 h-16
          rounded-full flex items-center justify-center
          text-3xl text-white
          bg-blue-600
          transition-shadow duration-200
          z-20
          hover:shadow-[0_0_20px_rgba(59,130,246,0.75)]
          active:shadow-[0_0_22px_rgba(59,130,246,0.85)]
          focus:outline-none focus:ring-4 focus:ring-blue-300
        "
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <i className={`fas fa-${isOpen ? "times" : "comment-dots"}`} />
      </button>

      {/* CHAT WINDOW */}
      {isOpen && (
  <div
  ref={chatRef}
  className="
    fixed bottom-24 right-5
    w-[92vw] sm:w-[420px] md:w-[480px]
    h-[75vh] md:h-[78vh]
    bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl border overflow-hidden
    border-gray-200 dark:border-gray-700 flex flex-col z-[9998]
    transition-shadow duration-200
    hover:shadow-[0_0_12px_3px_rgba(59,130,246,0.45)]
  "
>



{/* HEADER (PREMIUM) */}
<div className="px-4 py-3 bg-slate-900 dark:bg-slate-950 text-white flex justify-between items-center">

  <div className="flex items-center gap-3">
    <div className="relative">
      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold shadow-inner">
        BC
      </div>
      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-slate-900 rounded-full"></div>
    </div>

    <div>
      <div className="font-bold text-sm tracking-wide">Bible Companion</div>
      <div className="text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1">
        <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
        Ready to assist
      </div>
    </div>
  </div>

  {/* Controls */}
  <div ref={controlsRef} className="relative flex items-center gap-2">
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsModeDropdownOpen((v) => !v);
      }}      
      className="p-2 hover:bg-white/10 rounded-full transition-colors"
      aria-label="Chat settings"
      title="Chat settings"
    >
      <i className="fas fa-cog text-sm" />
    </button>

    <button
      onClick={onToggle}
      className="p-2 hover:bg-white/10 rounded-full transition-colors"
      aria-label="Close chat"
      title="Close"
    >
      ✕
    </button>

    {/* POPOVER */}
    {isModeDropdownOpen && (
      <div
        className="
          absolute right-0 top-12 w-52
          bg-white dark:bg-slate-900
          border border-slate-200 dark:border-slate-700
          rounded-2xl shadow-xl z-50
          p-3 space-y-3 text-slate-900 dark:text-white
        "
      >
        {/* Scope */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            Scope
          </label>
          <select
            value={chatScope}
            onChange={(e) => setChatScope(e.target.value as ChatScope)}
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 bg-white dark:bg-slate-800"
          >
            <option value="GLOBAL">Global</option>
            <option value="CHAPTER">Chapter</option>
            <option value="VERSE">Verse</option>
          </select>
        </div>

        {/* Depth */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            Answer Depth
          </label>
          <select
            value={answerDepth}
            onChange={(e) =>
              setAnswerDepth(e.target.value as "SHORT" | "MEDIUM" | "DEEP")
            }
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 bg-white dark:bg-slate-800"
          >
            <option value="SHORT">Short</option>
            <option value="MEDIUM">Medium</option>
            <option value="DEEP">Deep</option>
          </select>
        </div>

        {/* Language */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            Language
          </label>
          <select
            value={language}
            onChange={(e) => handleLanguageSelect(e.target.value as "EN" | "TE")}
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 bg-white dark:bg-slate-800"
          >
            <option value="EN">English</option>
            <option value="TE">తెలుగు</option>
          </select>
        </div>
      </div>
    )}
  </div>
</div>



          {/* MESSAGES */}
          <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
            {messages.length === 0 && (
              <div className="flex flex-col gap-4 mb-4">
                {/* WELCOME MESSAGE */}
                <div className="p-4 bg-blue-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm leading-relaxed">
                  <strong>{language === "TE" ? UI_TEXT.welcome_te : UI_TEXT.welcome_en}</strong>
                  <br />
                  {language === "TE"
                    ? "బైబిల్ గురించి మీకు ఉన్న ఏ ప్రశ్న అయినా అడగండి, నేను స్పష్టంగా వివరించి సహాయం చేస్తాను."
                    : "Ask me anything about Scripture, doctrine, or theology, and I’ll help you explore God’s Word."}
                </div>

                {/* MODEL GUIDE (only when empty)
                <div className="p-3 bg-yellow-100 dark:bg-gray-600 rounded-md text-xs text-gray-800 dark:text-gray-200 border border-yellow-300 dark:border-gray-500 leading-relaxed">
                  <strong>{language === "TE" ? "మోడల్ సూచిక:" : "Model Guide:"}</strong>

                  <span className="block mt-1">
                    <strong>{language === "TE" ? "ఫాస్ట్" : "Fast"}</strong> — {language === "TE" ? "త్వరిత సమాధానాలు మరియు సరళమైన వివరణల కోసం." : "quick answers and short explanations."}
                  </span>

                  <span className="block mt-1">
                    <strong>{language === "TE" ? "స్టాండర్డ్" : "Standard"}</strong> — {language === "TE" ? "స్పష్టమైన వివరణలు మరియు సాధారణ బైబిల్ అధ్యయనానికి." : "balanced mode for clear explanations and study."}
                  </span>

                  <span className="block mt-1">
                    <strong>{language === "TE" ? "డీప్ థాట్" : "Deep Thought"}</strong> — {language === "TE" ? "లోతైన దైవశాస్త్రం, బహు-వచనం విశ్లేషణ మరియు వివరణాత్మక అధ్యయనానికి." : "use for deep theology, multi-verse analysis, long-form reasoning."}
                  </span>

                  <span className="block mt-2 font-medium">{language === "TE" ? "పైన ఉన్న డ్రాప్‌డౌన్ ద్వారా ఎప్పుడైనా మోడల్‌ను మార్చవచ్చు." : "Switch models anytime using the dropdown above."}</span>
                </div> */}

                {/* TRY ASKING SECTION */}
                <div className="text-xs text-gray-600 dark:text-gray-300 font-semibold">{language === "TE" ? UI_TEXT.tryQuestions_te : UI_TEXT.tryQuestions_en}</div>

                {/* DEFAULT SUGGESTIONS */}
                <div className="flex flex-col gap-2 ">
                  {generateDefaultSuggestions().map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(q)}
                      className="
  w-full text-left p-4 text-[13px]
  rounded-2xl bg-white dark:bg-slate-800
  border border-slate-200 dark:border-slate-700
  hover:bg-slate-50 dark:hover:bg-slate-700
  transition shadow-sm
"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CHAT THREAD */}
            {messages.map((msg) =>
  msg.sender === "user" ? (
    <UserMessage key={msg.id} message={msg.text as string} />
  ) : msg.answer ? (
    <BotMessage
  key={msg.id}
  answer={msg.answer}
  sources={msg.sources}
  renderWithRefs={renderNodeWithRefs}
  onReferenceClick={handleClickReference}
/>

  ) : (
    <div key={msg.id} className="text-sm text-red-500">
      {typeof msg.text === "string" ? msg.text : "Invalid response"}
    </div>
  )
)}

{isLoading && <BotTyping />}



            {/* AI FOLLOW-UP QUESTIONS */}
            {followUpQs.length > 0 && (
              <div className="flex flex-col gap-2 mb-2 mt-2">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                {modelLanguageRef.current === "TE" ? UI_TEXT.followUpHeading_te : UI_TEXT.followUpHeading_en}
                </div>
                {followUpQs.map((q, i) => (
  <button
    key={i}
    onClick={() => handleSuggestionClick(q)}
    className="w-full text-left p-3 text-sm rounded-lg bg-blue-50 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-gray-600 transition-shadow duration-150 hover:shadow-[0_0_6px_rgba(0,0,0,0.06)]"
  >
    <div className="prose prose-sm dark:prose-invert max-w-none">
    <p className="text-sm">{q}</p>

    </div>
  </button>
))}

              </div>
            )}

            <div ref={messagesEndRef} />
          </div>



          {/* INPUT */}
          <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={language === "TE" ? UI_TEXT.placeholder_te : UI_TEXT.placeholder_en}
                className="
  flex-grow px-4 py-3 text-[13px]
  rounded-2xl
  border border-slate-200 dark:border-slate-700
  bg-white dark:bg-slate-800
  text-slate-900 dark:text-white
  placeholder:text-slate-400
  focus:outline-none focus:ring-2 focus:ring-blue-500
"
              />

              <button
                onClick={() => handleSend()}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800"
                title={language === "TE" ? UI_TEXT.send_te : UI_TEXT.send_en}
              >
                <i className="fas fa-paper-plane" />
              </button>
            </div>
          </div>
        </div>
      )}

{isPreviewOpen && (
  <ModalPortal>
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
      onMouseDown={() => setIsPreviewOpen(false)}
    >
      <div
        className="
          bg-white dark:bg-gray-800
          rounded-2xl w-full max-w-md
          shadow-xl
          flex flex-col
          max-h-[85vh]
        "
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (fixed) */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h3 className="text-base font-bold">{previewRef}</h3>
        </div>

        {/* Scrollable content */}
        <div className="p-4 overflow-y-auto flex-1 overscroll-contain">
        <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
            {previewText || "Verse not found."}
          </p>
        </div>

        {/* Footer (fixed) */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 shrink-0 flex justify-end">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setIsPreviewOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
)}


    </>
  );
};