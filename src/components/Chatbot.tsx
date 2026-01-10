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
  welcome_en: `👋 Hello! I'm BibleBot — your AI-powered Bible study assistant 📖✨`,
  welcome_te: `👋 హలో! నేనే బైబిల్‌బాట్ — మీ AI ఆధారిత బైబిల్ అధ్యయన సహాయకుడు 📖✨`,

  tryQuestions_en: `Try questions like:`,
  tryQuestions_te: `ఈ తరహా ప్రశ్నలను ప్రయత్నించండి:`,

  followUpHeading_en: `Try more questions like:`,
  followUpHeading_te: `ఇంకా ఈ తరహా ప్రశ్నలు ప్రయత్నించండి:`,

  placeholder_en: `Ask a theological question...`,
  placeholder_te: `దైవశాస్త్ర ప్రశ్న అడగండి...`,

  send_en: `Send`,
  send_te: `పంపండి`,
};




// BOT MESSAGE COMPONENT
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
    setOpenSections(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="flex items-start gap-2.5">
      <div className="flex flex-col w-full max-w-[320px] p-4 bg-gray-100 dark:bg-gray-700 rounded-e-xl rounded-es-xl">
        {answer.sections.map((sec, i) => (
          <div
            key={i}
            className="mb-3 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between px-3 py-2 text-left bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              <span className="font-semibold text-sm">{sec.title}</span>
              <span className="text-xs opacity-70">
                {openSections[i] ? "−" : "+"}
              </span>
            </button>

            {openSections[i] && (
              <div className="p-3 space-y-2 bg-gray-100 dark:bg-gray-700">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {renderWithRefs(sec.explanation)}
                </div>

                {sec.references.length > 0 && (
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    References:{" "}
                    {sec.references.map((ref, j) => (
                      <span
                        key={j}
                        className="underline cursor-pointer mr-2"
                        onClick={() => onReferenceClick(ref)}
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {sources?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
            <h4 className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
              Sources:
            </h4>
            <ul className="list-disc list-inside space-y-1">
              {sources.map((s, i) => (
                <li key={i} className="text-xs">
                  <a
                    href={s.web?.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
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




// USER MESSAGE COMPONENT
const UserMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start justify-end gap-2.5">
    <div className="flex flex-col w-full max-w-[320px] leading-1.5 p-4 bg-blue-600 dark:bg-blue-700 text-white rounded-s-xl rounded-ee-xl">
      <p className="text-sm font-normal">{message}</p>
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
  englishVersion: string;
  isOpen: boolean;
  onToggle: () => void;
}

type ChatScope = "GLOBAL" | "VERSE" | "CHAPTER";

export const Chatbot: React.FC<ChatbotProps> = ({
  selectedBook,
  selectedChapter,
  selectedVerseRef,
  verses,
  englishVersion,
  isOpen,
  onToggle,
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


  const [messages, setMessages] = useState<Message[]>([]);
  const [followUpQs, setFollowUpQs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  // Detect initial chatbot language from current Bible version
const detectInitialLanguage = (): "EN" | "TE" => {
  return englishVersion === "BSI_TELUGU" ? "TE" : "EN";
};


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
      const target = e.target as Node;
  
      if (
        chatRef.current &&
        !chatRef.current.contains(target) &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(target)
      ) {
        onToggle(); // close chatbot
      }
    };
  
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (!isOpen) return;
  
    const initialLang = detectInitialLanguage();
    setLanguage(initialLang);
    setModelLanguage(initialLang);
    setFollowUpQs([]);
  }, [isOpen]); // ❗ ONLY isOpen
  
  

  useEffect(() => {
    const handler = (e: any) => {
      // ❌ Never stream when structured JSON is expected
      if (isLoading) return;
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
  

  // Follow-up generation: uses modelLanguage (ensures future follow-ups match selected model language)
  const generateAIFollowUps = async (
    answerJson: ChatbotAnswer,
    history: Message[]
  ): Promise<string[]> => {
    const langInstruction =
      modelLanguage === "TE"
        ? "ప్రశ్నలను తెలుగులో ఇవ్వండి."
        : "Return questions in English.";
  
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
  - Plain text only
  - No markdown
  - No headings
  - No explanations
  - No Bible verses quoted
  - No bullet symbols
  
  Base them on these section titles:
  ${answerJson.sections.map(s => `- ${s.title}`).join("\n")}
  
  ${langInstruction}
  `;
  
    let resultText = "";
  
    try {
      const result = await sendMessageToLlama(prompt, history, modelLanguage);
      resultText = result.text;
    } catch {
      return [];
    }
  
    try {
      const jsonText = extractJsonFromSentinel(resultText);
      const parsed = JSON.parse(jsonText);
  
      if (!Array.isArray(parsed.questions)) {
        return [];
      }
  
      return parsed.questions.slice(0, 3);
    } catch (err) {
      // 🔒 HARD FAIL SAFE — NEVER THROW
      console.warn("Follow-up generation skipped (non-fatal):", err);
      return [];
    }
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
  
      const chapterData = await fetchChapter(meta.name, chapter);
      if (!chapterData?.length) return "";
  
      return chapterData
        .filter(v => v.verse >= startVerse && v.verse <= endVerse)
        .map(v =>
          language === "TE"
            ? v.text.BSI_TELUGU || v.text.KJV
            : v.text[englishVersion] || v.text.KJV
        )
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
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in AI response");
  }

  return text.slice(firstBrace, lastBrace + 1);
};




const buildContextualInput = (input: string) => {
  if (chatScope === "VERSE" && selectedVerseRef) {
    const verseData = verses.find(v => v.verse === selectedVerseRef.verse);
    const verseText =
      verseData?.text[englishVersion] || verseData?.text.KJV;

    return verseText
      ? `Answer strictly in the context of ${selectedVerseRef.book} ${selectedVerseRef.chapter}:${selectedVerseRef.verse} (${verseText}): ${input}`
      : `Answer in the context of ${selectedVerseRef.book} ${selectedVerseRef.chapter}:${selectedVerseRef.verse}: ${input}`;
  }

  if (chatScope === "CHAPTER" && selectedBook && selectedChapter) {
    return `Answer in the context of ${selectedBook} chapter ${selectedChapter}: ${input}`;
  }

  // GLOBAL CHAT (no Bible anchoring)
  return input;
};





  // SEND MESSAGE
  const handleSend = async (forcedInput?: string) => {
    // clear old follow-ups (they belong to previous bot answer)
    setFollowUpQs([]);

    const finalInput = forcedInput ?? input.trim();
if (!finalInput || isLoading) return;

// STEP 3: detect direct question
const isDirectQuestion = /\?$/.test(finalInput);

const formattingRules = `
SYSTEM INSTRUCTION (CRITICAL):

You MUST return a SINGLE valid JSON object.
DO NOT include:
- markdown
- headings
- explanations
- bullet points
- plain text
- emojis
- comments
- code fences

If you cannot comply, return this EXACT JSON and nothing else:
{
  "sections": [
    {
      "title": "Error",
      "explanation": "The model failed to generate structured output.",
      "references": []
    }
  ]
}

REQUIRED SCHEMA:
{
  "sections": [
    {
      "title": string,
      "explanation": string,
      "references": string[]
    }
  ]
}

RULES:
- references must be Bible references only (e.g. "John 3:16")
- Use plain text only
- No markdown
- No numbering

RETURN JSON ONLY.
`;




    const userMessage: Message = {
      id: Date.now().toString(),
      text: finalInput,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);


    const contextualizedInput = buildContextualInput(finalInput);

    // Use modelLanguage for AI instruction (this guarantees Option B)
    const langInstruction = modelLanguage === "TE" ? "సమాధానం తెలుగులో ఇవ్వండి." : "Answer in English.";

    try {
      const response = await sendMessageToLlama(
        `${contextualizedInput}
      
      ${langInstruction}
      
      ${formattingRules}`,
        [...messages, userMessage],
        modelLanguage
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
        title: "Explanation",
        explanation: normalizeText(response.text),
        references: []
      }
    ]
  };
}


if (!Array.isArray(parsed.sections)) {
  parsed = {
    sections: [
      {
        title: "Explanation",
        explanation: normalizeText(response.text),

        references: []
      }
    ]
  };
}

const botMessage: Message = {
  id: (Date.now() + 1).toString(),
  sender: "bot",
  answer: parsed,
  sources: response.sources,
};

      

      setMessages((prev) => [...prev, botMessage]);

      // generate follow-ups using the same model language
      try {
        const aiQs = await generateAIFollowUps(
          parsed,
          [...messages.filter(m => m.sender === "user"), userMessage]
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
          ? modelLanguage === "TE"
            ? "AI మోడల్ ఓవరోడెడ్ అయ్యింది. దయచేసి మోడల్ మార్చండి."
            : "The AI model is overloaded. Try switching models."
          : modelLanguage === "TE"
          ? "ఏదో తప్పిపోయింది. దయచేసి మళ్లీ ప్రయత్నించండి."
          : "Something went wrong. Please try again.";

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: fallback,
        sender: "bot",
      };

      setMessages((prev) => [...prev, errorMessage]);
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
    setLanguage(newLang);       // controls UI text & suggestions
    setModelLanguage(newLang);  // controls future AI replies & follow-ups
    setFollowUpQs([]);          // clear any old-language follow-ups
    setIsLangDropdownOpen(false);
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
      fixed bottom-24 right-5 w-[90vw] max-w-md h-[70vh]

            bg-white dark:bg-gray-800 rounded-xl shadow-2xl border
            border-gray-200 dark:border-gray-700 flex flex-col z-50
            transition-shadow duration-200
            hover:shadow-[0_0_12px_3px_rgba(59,130,246,0.45)]
          "
        >
          {/* HEADER */}
          <header className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 rounded-t-xl">
          <h3 className="text-sm font-semibold leading-tight">
  Bible Companion Assistant
</h3>


            <div className="relative flex items-center gap-3">
              {/* 
=======================
 MODEL DROPDOWN DISABLED
 (Future Multi-Model Support)
=======================

<div className="relative">
  <button ...>
    {CHAT_MODE_LABELS[chatMode]}
    <i className="fas fa-caret-down text-[10px] opacity-80"></i>
  </button>

  {isModeDropdownOpen && (
    <div className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700">
      <button ...>Fast</button>
      <button ...>Standard</button>
      <button ...>Deep Thought</button>
    </div>
  )}
</div>

*/}
              <select
  value={chatScope}
  onChange={(e) => setChatScope(e.target.value as ChatScope)}
  className="text-[11px] border rounded px-1.5 py-0.5"
>

  <option value="GLOBAL">Global Chat</option>
  <option value="CHAPTER">This Chapter</option>
  <option value="VERSE">This Verse</option>
</select>


              {/* Language dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsLangDropdownOpen((prev) => !prev)}
                  className="
                    bg-gray-50 dark:bg-gray-700
                    border border-gray-300 dark:border-gray-600
                    text-gray-900 dark:text-white
                    text-[11px] rounded-md px-2 py-0.5
                    flex items-center gap-2
                    transition-all duration-150
                    hover:bg-gray-100 dark:hover:bg-gray-600
                    hover:shadow-[0_0_6px_1px_rgba(0,0,0,0.12)]
                    focus:outline-none focus:ring-2 focus:ring-blue-200
                  "
                >
                  <span aria-hidden>🌐</span>
                  <span className="text-[12px] font-medium">{language}</span>
                  <i className="fas fa-caret-down text-[10px] opacity-80"></i>
                </button>

                {isLangDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-28 rounded-lg shadow-lg z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700">
                    <button
                      onClick={() => handleLanguageSelect("EN")}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      EN
                    </button>

                    <button
                      onClick={() => handleLanguageSelect("TE")}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      TE
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* MESSAGES */}
          <div className="flex-grow p-4 overflow-y-auto space-y-4">
            {/* START SUGGESTIONS + WELCOME (only when empty) */}
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
                      className="w-full text-left p-3 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-shadow duration-150 hover:shadow-[0_0_6px_rgba(0,0,0,0.06)]"
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


            {/* AI FOLLOW-UP QUESTIONS */}
            {followUpQs.length > 0 && (
              <div className="flex flex-col gap-2 mb-2 mt-2">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  {modelLanguage === "TE" ? UI_TEXT.followUpHeading_te : UI_TEXT.followUpHeading_en}
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

          {/* LOADING INDICATOR (OUTSIDE THREAD) */}
          {isLoading && (
            <div className="p-3 flex justify-center opacity-70">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          )}

          {/* INPUT */}
          <div className="p-4 border-t border-gray-300 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={language === "TE" ? UI_TEXT.placeholder_te : UI_TEXT.placeholder_en}
                className="flex-grow p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
      onClick={() => setIsPreviewOpen(false)}
    >
      <div
        className="bg-white dark:bg-gray-800 p-4 rounded-lg max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2">
          {previewRef}
        </h3>

        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {previewText || "Verse not found."}
        </p>

        <div className="mt-4 text-right">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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