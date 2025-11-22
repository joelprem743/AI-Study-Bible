// src/components/Chatbot.tsx
import React, { useState, useRef, useEffect } from "react";
import type { Message, GroundingChunk, Verse, VerseReference } from "../types";
import { ChatMode } from "../types";
import { sendMessageToBot } from "../services/geminiService";

// Helper translations (simple conversational Telugu)
const UI_TEXT = {
  welcome_en: `Hello! I'm BibleBot — your AI-powered Bible study assistant.`,
  welcome_te: `హలో! నేనే బైబిల్‌బాట్ — మీ AI ఆధారిత బైబిల్ అధ్యయన సహాయకుడు.`,

  modelGuideTitle_en: `Model Guide:`,
  modelGuideTitle_te: `మోడల్ సూచిక:`,

  modelFast_en: `Fast — quick answers and short explanations.`,
  modelFast_te: `ఫాస్ట్ — త్వరిత సమాధానాలు మరియు సరళమైన వివరణలు.`,

  modelStandard_en: `Standard — balanced mode for clear explanations.`,
  modelStandard_te: `స్టాండర్డ్ — స్పష్టమైన వివరణలు మరియు సాధారణ అధ్యయనానికి.`,

  modelDeep_en: `Deep Thought — deep theology & multi-verse analysis.`,
  modelDeep_te: `డీప్ థాట్ — లోతైన దైవశాస్త్రం & బహు-వచన విశ్లేషణ.`,

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
  message: string | React.ReactNode;
  sources?: GroundingChunk[];
}> = ({ message, sources }) => (
  <div className="flex items-start gap-2.5">
    <div className="flex flex-col w-full max-w-[320px] leading-1.5 p-4 bg-gray-100 dark:bg-gray-700 rounded-e-xl rounded-es-xl">
      <div className="text-sm font-normal text-gray-900 dark:text-white whitespace-pre-wrap">
        {message}
      </div>

      {sources && sources.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
          <h4 className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">Sources:</h4>
          <ul className="list-disc list-inside space-y-1">
            {sources
              .filter((s) => s.web?.uri)
              .map((source, i) => (
                <li key={i} className="text-xs">
                  <a
                    href={source.web.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {source.web.title || source.web.uri}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  </div>
);

// USER MESSAGE COMPONENT
const UserMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start justify-end gap-2.5">
    <div className="flex flex-col w-full max-w-[320px] leading-1.5 p-4 bg-blue-600 dark:bg-blue-700 text-white rounded-s-xl rounded-ee-xl">
      <p className="text-sm font-normal">{message}</p>
    </div>
  </div>
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

  const [chatMode, setChatMode] = useState<ChatMode>(ChatMode.FAST);

  const [messages, setMessages] = useState<Message[]>([]);
  const [followUpQs, setFollowUpQs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const CHAT_MODE_LABELS = {
    [ChatMode.FAST]: language === "TE" ? "ఫాస్ట్" : "Fast",
    [ChatMode.STANDARD]: language === "TE" ? "స్టాండర్డ్" : "Standard",
    [ChatMode.DEEP_THOUGHT]: language === "TE" ? "డీప్ థాట్" : "Deep Thought",
  } as Record<ChatMode, string>;

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages, followUpQs]);

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

  // Follow-up generation: uses modelLanguage (ensures future follow-ups match selected model language)
  const generateAIFollowUps = async (botResponse: string, history: Message[]) => {
    const langInstruction = modelLanguage === "TE" ? "సమాధానం తెలుగులో ఇవ్వండి." : "Answer in English.";

    const metaInstruction = `You generate ONLY follow-up questions.\n\nGiven the answer below, return EXACTLY 3 short follow-up questions in the same language as requested.\nReturn a JSON array only.\n\n${botResponse}\n\nFormat:\n["q1", "q2", "q3"]`;

    const tempMetaMessage: Message = {
      id: "meta-" + Date.now(),
      text: metaInstruction + `\n\n${langInstruction}`,
      sender: "user",
    };

    const result = await sendMessageToBot(metaInstruction + `\n\n${langInstruction}`, [...history, tempMetaMessage], ChatMode.FAST);

    try {
      let clean = result.text || "";
      clean = clean.replace(/```json/gi, "").replace(/```/g, "").trim();
      clean = clean.replace(/,\s*]/g, "]");
      // Try to extract the first JSON array occurrence
      const arrayMatch = clean.match(/\[[\s\S]*?\]/);
      if (arrayMatch) clean = arrayMatch[0];
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) return parsed.map((s) => String(s));
    } catch (err) {
      console.error("Follow-up parse failed:", err, result?.text);
    }

    return [];
  };

  // SEND MESSAGE
  const handleSend = async (forcedInput?: string) => {
    // clear old follow-ups (they belong to previous bot answer)
    setFollowUpQs([]);

    const finalInput = forcedInput ?? input.trim();
    if (!finalInput || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: finalInput,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Build contextualized input
    let contextualizedInput = finalInput;

    if (selectedVerseRef) {
      const verseData = verses.find((v) => v.verse === selectedVerseRef.verse as any);
      const verseText = verseData?.text[englishVersion as keyof typeof verseData.text] || verseData?.text.KJV;

      contextualizedInput = verseText
        ? `Given the context of ${selectedVerseRef.book} ${selectedVerseRef.chapter}:${selectedVerseRef.verse}, which reads "${verseText}", answer the following: ${finalInput}`
        : `Regarding ${selectedVerseRef.book} ${selectedVerseRef.chapter}:${selectedVerseRef.verse}, answer the following: ${finalInput}`;
    } else {
      contextualizedInput = `Regarding ${selectedBook} ${selectedChapter}, answer: ${finalInput}`;
    }

    // Use modelLanguage for AI instruction (this guarantees Option B)
    const langInstruction = modelLanguage === "TE" ? "సమాధానం తెలుగులో ఇవ్వండి." : "Answer in English.";

    try {
      const response = await sendMessageToBot(`${contextualizedInput}\n\n${langInstruction}`, [...messages, userMessage], chatMode);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.text,
        sender: "bot",
        sources: response.sources,
      };

      setMessages((prev) => [...prev, botMessage]);

      // generate follow-ups using the same model language
      try {
        const aiQs = await generateAIFollowUps(response.text, [...messages, userMessage, botMessage]);
        setFollowUpQs(aiQs);
      } catch (err) {
        console.error("Follow-up generation failed:", err);
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
          className="
            fixed bottom-24 right-5 w-[90vw] max-w-md h-[70vh]
            bg-white dark:bg-gray-800 rounded-xl shadow-2xl border
            border-gray-200 dark:border-gray-700 flex flex-col z-50
            transition-shadow duration-200
            hover:shadow-[0_0_12px_3px_rgba(59,130,246,0.45)]
          "
        >
          {/* HEADER */}
          <header className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 rounded-t-xl">
            <h3 className="text-lg font-bold">AI Bible Bot</h3>

            <div className="relative flex items-center gap-3">
              {/* Model dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsModeDropdownOpen((prev) => !prev)}
                  className="
                    bg-gray-50 dark:bg-gray-700
                    border border-gray-300 dark:border-gray-600
                    text-gray-900 dark:text-white
                    text-xs rounded-lg px-3 py-1.5
                    flex items-center gap-2
                    transition-all duration-150
                    hover:bg-gray-100 dark:hover:bg-gray-600
                    hover:shadow-[0_0_6px_1px_rgba(0,0,0,0.12)]
                    focus:outline-none focus:ring-2 focus:ring-blue-200
                  "
                >
                  {CHAT_MODE_LABELS[chatMode]}
                  <i className="fas fa-caret-down text-[10px] opacity-80"></i>
                </button>

                {isModeDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700">
                    <button
                      onClick={() => {
                        setChatMode(ChatMode.FAST);
                        setIsModeDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {language === "TE" ? "ఫాస్ట్" : "Fast"}
                    </button>

                    <button
                      onClick={() => {
                        setChatMode(ChatMode.STANDARD);
                        setIsModeDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {language === "TE" ? "స్టాండర్డ్" : "Standard"}
                    </button>

                    <button
                      onClick={() => {
                        setChatMode(ChatMode.DEEP_THOUGHT);
                        setIsModeDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {language === "TE" ? "డీప్ థాట్" : "Deep Thought"}
                    </button>
                  </div>
                )}
              </div>

              {/* Language dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsLangDropdownOpen((prev) => !prev)}
                  className="
                    bg-gray-50 dark:bg-gray-700
                    border border-gray-300 dark:border-gray-600
                    text-gray-900 dark:text-white
                    text-xs rounded-lg px-3 py-1.5
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

                {/* MODEL GUIDE (only when empty) */}
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
                </div>

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
              ) : (
                <BotMessage key={msg.id} message={msg.text} sources={msg.sources} />
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
                    {q}
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
    </>
  );
};
