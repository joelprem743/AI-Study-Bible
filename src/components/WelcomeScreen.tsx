  // src/components/WelcomeScreen.tsx
  import React, { useEffect, useState } from "react";
  import {
    getOrCreateDailyVerse,
    updateDailyVerse,
  } from "../lib/dailyVerseService";
  import { fetchVerseByRef, BibleVerseRow } from "../lib/bibleVersesService";
  import { sendMessageToLlama } from "../services/geminiService";
  import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
  import VerseImageShare from "./VerseImageShare";

  import ModalPortal from "./ModalPortal";

  interface WelcomeScreenProps {
    onDismiss: () => void;

    // ✅ NEW: Used to open chatbot + auto explain this verse
    onExplainVerse: (payload: {
      book: string;
      chapter: number;
      verse: number;
      language: "EN" | "TE";
    }) => void;
  }

  type UILang = "EN" | "TE";
  

  const extractJsonSmart = (text: string) => {
    const sentinel = text.match(/<json>([\s\S]*?)<\/json>/i);
    if (sentinel) return sentinel[1].trim();

    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      return text.slice(first, last + 1).trim();
    }

    return "";
  };

  const getDisplayBookName = (book: string, language: "EN" | "TE") => {
    if (language === "TE") {
      return (TELUGU_BOOK_NAMES as any)[book] || book;
    }
    return book;
  };

  export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    onDismiss,
    onExplainVerse,
  }) => {
    const [language, setLanguage] = useState<UILang>("EN");

    const [loadingVerse, setLoadingVerse] = useState(true);
    const [loadingDevotional, setLoadingDevotional] = useState(true);
    

    const [verseRow, setVerseRow] = useState<BibleVerseRow | null>(null);

    const [meaning, setMeaning] = useState<string>("");
    const [application, setApplication] = useState<string>("");
    // const [openImageShare, setOpenImageShare] = useState(false);
    type ShareStep = "background" | "content" | null;

    const [shareStep, setShareStep] = useState<ShareStep>(null);
    
    const [selectedBackground, setSelectedBackground] =
      useState<string | null>(null);
    
    const [selectedGradient, setSelectedGradient] =
      useState<{ from: string; to: string } | null>(null);
    
    // -----------------------------
// Share Daily Verse state
// -----------------------------



const isTeluguUI = language === "TE";
const teluguUiClass = isTeluguUI ? "font-telugu" : "font-sans";


    useEffect(() => {
      let cancelled = false;

      const run = async () => {
        setLoadingVerse(true);
        setLoadingDevotional(true);

        // -----------------------------
        // Step 1: Fetch daily verse ref
        // -----------------------------
        let daily: Awaited<ReturnType<typeof getOrCreateDailyVerse>>;
        try {
          daily = await getOrCreateDailyVerse();
        } catch (err) {
          console.error("Daily verse fetch/create failed:", err);
          if (!cancelled) {
            setLoadingVerse(false);
            setLoadingDevotional(false);
            setMeaning(language === "TE" ? "లోడ్ కాలేదు." : "Failed to load.");
            setApplication("");
          }
          return;
        }

        // -----------------------------
        // Step 2: Fetch Verse text
        // -----------------------------


        const bibleVersion = language === "TE" ? "TELUGU_COMMUNITY_V1" : "ESV";

        try {
          const v = await fetchVerseByRef(
            daily.book,
            daily.chapter,
            daily.verse,
            bibleVersion
          );
          if (!cancelled) setVerseRow(v);
        } catch (err) {
          console.warn("Verse fetch failed, fallback to ESV:", err);

          try {
            const fallback = await fetchVerseByRef(
              daily.book,
              daily.chapter,
              daily.verse,
              "ESV"
            );
            if (!cancelled) setVerseRow(fallback);
          } catch (err2) {
            console.error("Verse fetch failed for both versions:", err2);
            if (!cancelled) setVerseRow(null);
          }
        } finally {
          if (!cancelled) setLoadingVerse(false);
        }

        // -----------------------------
        // Step 3: Meaning/Application
        // -----------------------------
        const storedMeaning =
          language === "TE" ? daily.meaning_te : daily.meaning_en;

        const storedApplication =
          language === "TE" ? daily.application_te : daily.application_en;

        if (storedMeaning && storedApplication) {
          if (!cancelled) {
            setMeaning(storedMeaning);
            setApplication(storedApplication);
            setLoadingDevotional(false);
          }
          return;
        }

        // -----------------------------
        // Step 4: Generate devotional via AI
        // -----------------------------
        try {
          const verseTextForPrompt =
            verseRow?.text || `${daily.book} ${daily.chapter}:${daily.verse}`;

          const prompt = `
  SYSTEM:
  Return ONLY valid JSON. No markdown. No extra text.

  Schema:
  {
    "meaning": "string",
    "application": "string"
  }

  Verse:
  "${verseTextForPrompt}"
  Reference: ${daily.book} ${daily.chapter}:${daily.verse}

  Rules:
  - meaning: 2–3 simple sentences
  - meaning MUST be written in second person
  - meaning must address the reader directly (use "you")
  - DO NOT explain or describe the verse
  - DO NOT use teaching language ("learn", "understand", "this shows", "this verse says")
  - meaning should feel personal, comforting, and direct

  - application: 2–3 short practical steps
  - application MUST also be in second person
  - application must be actionable for today

  - NO emojis
  - NO third-person language of any kind
  - NO meta or commentary tone

  - If language is Telugu:
    - output must be fully Telugu
    - MUST use second-person Telugu grammar (నీవు / మీరు)
    - DO NOT mix English words
          

  Language: ${language === "TE" ? "Telugu" : "English"}
  `.trim();

          const ai = await sendMessageToLlama(prompt, [], language, "SHORT");

          const jsonText = extractJsonSmart(ai.text);
          if (!jsonText) throw new Error("AI did not return JSON.");

          const parsed = JSON.parse(jsonText);

          const aiMeaning = String(parsed.meaning ?? "").trim();
          const aiApplication = String(parsed.application ?? "").trim();

          if (!aiMeaning || !aiApplication) {
            throw new Error("AI returned empty meaning/application.");
          }

          const patch =
            language === "TE"
              ? { meaning_te: aiMeaning, application_te: aiApplication }
              : { meaning_en: aiMeaning, application_en: aiApplication };

          await updateDailyVerse(daily.day, patch);

          if (!cancelled) {
            setMeaning(aiMeaning);
            setApplication(aiApplication);
          }
        } catch (err) {
          console.error("AI devotional generation failed:", err);

          if (!cancelled) {
            setMeaning(
              language === "TE"
                ? "ఈ వాక్యం మన విశ్వాసాన్ని బలపరుస్తుంది."
                : "This verse strengthens faith."
            );
            setApplication(
              language === "TE"
                ? "ఈ రోజు ఒక పని: ప్రార్థనతో దేవుని మీద నమ్మకం ఉంచండి."
                : "One step today: pray and choose trust."
            );
          }
        } finally {
          if (!cancelled) setLoadingDevotional(false);
        }
      };

      run();

      return () => {
        cancelled = true;
      };
    }, [language]);

    const toggleLanguage = () => {
      setLanguage((prev) => (prev === "EN" ? "TE" : "EN"));
    };

    const handleExplainVerse = () => {
      if (!verseRow) return;

      // ✅ Close welcome screen
      onDismiss();

      // ✅ Tell parent to open chatbot and explain this verse
      onExplainVerse({
        book: verseRow.book,
        chapter: verseRow.chapter,
        verse: verseRow.verse,
        language,
      });
    };


    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">

        <div className="
  bg-white dark:bg-gray-800
  rounded-[2.5rem] shadow-2xl
  max-w-2xl w-full
  h-[90vh]
  overflow-hidden
  border border-slate-700 dark:border-slate-700
  flex flex-col
">
          
          {/* ✅ Header (theme match only) */}
{/* ✅ Header */}
<div className="px-5 sm:px-6 py-4 sm:py-5 bg-slate-900 dark:bg-slate-950 text-white">

  {/* ✅ Row 1 (relative container for controls) */}
  <div className="relative flex items-center">
    
    {/* Title */}
    <h1 className="text-lg sm:text-xl font-bold tracking-wide leading-tight text-left pr-24 sm:pr-0">
    {language === "TE" ? "నేటి వాక్యం" : "Today’s Verse"}

    </h1>

    {/* Right controls (aligned to Row 1 center) */}
    <div className="absolute -right-1 top-1/2 -translate-y-1/2 flex items-center gap-1.5 sm:gap-3">
  <button
    onClick={toggleLanguage}
    className="
      px-2 py-1 text-[10px] rounded-full
      border border-white/10
      bg-white/5
      text-slate-200
      hover:bg-white/10
      hover:border-white/15
      transition
      whitespace-nowrap
      leading-none
    "
  >
    {language === "TE" ? "EN" : "తెలుగు"}
  </button>


      <button
        onClick={onDismiss}
        className="w-10 h-10 rounded-full hover:bg-white/10 transition flex items-center justify-center"
        aria-label="Close"
        title="Close"
      >
        ✕
      </button>
    </div>
  </div>

  {/* ✅ Row 2 subtitle (unchanged) */}
  <p
    className="
      mt-2
      text-[11px] sm:text-xs
      text-slate-300
      uppercase
      tracking-wide sm:tracking-widest
      text-left
      pr-24 sm:pr-0
      whitespace-nowrap
    "
  >
    {language === "TE"
      ? "మీ రోజును దేవుని వాక్యంతో ప్రారంభించండి."
      : "Start your day with God’s Word."}
  </p>
</div>

          {/* ✅ Body scroll area */}
          <div className="
  flex-1 min-h-0
  p-4 sm:p-5
  pb-6
  overflow-y-auto
  bg-slate-50/50 dark:bg-slate-900/40
  space-y-4
">

            
            {/* Verse Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              {loadingVerse ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {language === "TE" ? "లోడ్ అవుతోంది..." : "Loading..."}
                </p>
              ) : verseRow ? (
                <>
                  <p
  className={`
    text-lg md:text-xl
    text-slate-900 dark:text-white
    leading-relaxed
    ${teluguUiClass}
    ${isTeluguUI ? "font-medium tracking-[0.2px] leading-[1.85]" : "font-semibold"}
  `}
>
  “{verseRow.text}”
</p>

    
<div className="mt-4 flex items-center justify-between gap-3">
  <p
    className={`
      text-sm text-slate-600 dark:text-slate-300
      ${teluguUiClass}
      ${isTeluguUI ? "font-medium tracking-[0.2px]" : "font-semibold"}
    `}
  >
    {getDisplayBookName(verseRow.book, language)} {verseRow.chapter}:{verseRow.verse}
  </p>

  <div className="flex items-center gap-2">
  <button
  onClick={() => setShareStep("background")}
  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
>
  {language === "TE" ? "షేర్ చేయి" : "Share"}
</button>


    <span className="text-[10px] px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 font-bold tracking-widest">
      {language === "TE" ? "రోజు వాక్యం" : "DAILY VERSE"}
    </span>
  </div>
</div>

                </>
              ) : (
                <p className="text-sm text-red-500">
                  {language === "TE"
                    ? "వాక్యం అందుబాటులో లేదు."
                    : "Verse not available."}
                </p>
              )}
            </div>
    
            {/* Meaning */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3
  className={`
    text-xs font-bold uppercase tracking-widest
    text-slate-600 dark:text-slate-300
    ${teluguUiClass}
  `}
>

                {language === "TE" ? "అర్థం" : "Meaning"}
              </h3>
    
              {loadingDevotional ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  {language === "TE" ? "సిద్ధమవుతోంది..." : "Preparing..."}
                </p>
              ) : (
                <p
  className={`
    mt-3 text-sm text-slate-800 dark:text-slate-200
    leading-relaxed
    ${teluguUiClass}
    ${isTeluguUI ? "tracking-[0.2px] leading-[1.85]" : ""}
  `}
>
  {meaning}
</p>

              )}
            </div>
    
{/* Application */}
<div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
    {language === "TE" ? "ఈ రోజు ఆచరణ" : "Live it today"}
  </h3>

  {loadingDevotional ? (
    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
      {language === "TE" ? "సిద్ధమవుతోంది..." : "Preparing..."}
    </p>
  ) : (
    <p
  className={`
    mt-3 text-sm text-slate-800 dark:text-slate-200
    leading-relaxed
    ${teluguUiClass}
    ${isTeluguUI ? "tracking-[0.2px] leading-[1.85]" : ""}
  `}
>
  {application}
</p>

  )}
</div>

{/* ✅ Buttons (scroll with content) */}
<div className="pt-2">
  <div className="flex flex-col sm:flex-row gap-3 justify-center">
    <button
      onClick={onDismiss}
      className="
        w-full px-8 py-4
        bg-blue-600 text-white font-semibold
        rounded-2xl shadow-md
        hover:bg-blue-700 transition
      "
    >
      {language === "TE" ? "బైబిల్ తెరవండి" : "Open Bible"}
    </button>

    <button
      onClick={handleExplainVerse}
      disabled={!verseRow}
      className="
        w-full px-8 py-4
        bg-white dark:bg-slate-900
        text-slate-900 dark:text-white
        font-semibold rounded-2xl
        border border-slate-200 dark:border-slate-700
        hover:bg-slate-50 dark:hover:bg-slate-800
        transition
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      {language === "TE" ? "ఈ వాక్యం వివరించండి" : "Explain this verse"}
    </button>
  </div>
</div>


        </div>
        </div>
{/* STEP 2 — Verse / Reflection selector */}
{shareStep === "content" && verseRow && (
  <ModalPortal>
    
<VerseImageShare
  verseRef={{
    book: verseRow.book,
    chapter: verseRow.chapter,
    verse: verseRow.verse,
  }}
  verseText={verseRow.text}
  meaning={meaning}              // ✅ THIS WAS MISSING
  language={language}
  backgroundUrl={selectedBackground}
  gradient={selectedGradient}
  onClose={() => setShareStep(null)}
  onBack={() => setShareStep("background")}
/>


  </ModalPortal>
)}


{/* STEP 1 — Background / Gradient picker */}
{shareStep === "background" && verseRow && (
  <ModalPortal>
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
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
        ? "నేపథ్యాన్ని ఎంచుకోండి"
        : "Choose a background style"}
    </p>
  </div>

  <button
    onClick={() => setShareStep(null)}
    className="
      w-9 h-9 rounded-full
      bg-white/10 hover:bg-white/20
      flex items-center justify-center
      transition
    "
    aria-label="Close"
  >
    ✕
  </button>
</div>

        {/* --- BACKGROUND GRID (10 images) --- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5 mb-8">

          {/* Gradient option */}
          <button
            onClick={() => {
              setSelectedBackground(null);
              setSelectedGradient({ from: "#eef2ff", to: "#f8fafc" });
              setShareStep("content");
            }}
            className="
              aspect-square rounded-2xl
              border border-slate-200 dark:border-slate-700
              bg-gradient-to-br from-indigo-50 to-slate-100
              dark:from-slate-800 dark:to-slate-700
              flex items-center justify-center
              text-sm font-semibold text-slate-700 dark:text-slate-200
              hover:scale-[1.03] hover:shadow-md
              transition
            "
          >
  <span className="text-xl">🎨</span>
  <span className="text-xs font-semibold opacity-80">
    Gradient
  </span>
            </button>
          

          {/* Example image placeholders (replace with your real URLs) */}
          {[
            "mountain-sunrise",
            "ocean-waves",
            "forest-path",
            "desert-dunes",
            "mountain-lake",
            "sunset-fields",
            "coastal-cliffs",
            "autumn-forest",
            "mountain-peak",
            "peaceful-meadow",
          ].map((id) => (
            <button
              key={id}
              onClick={() => {
                setSelectedBackground(`/verse-bg/${id}.png`);
                setSelectedGradient(null);
                setShareStep("content");
              }}
              className="
              group aspect-square rounded-2xl overflow-hidden
              border border-slate-200 dark:border-slate-700
              hover:scale-[1.03]
              hover:shadow-lg
              transition
            "
            >
<img
  src={`/verse-bg/${id}.png`}
  className="w-full h-full object-cover group-hover:brightness-105 transition"
  alt={id}
/>

            </button>
          ))}
        </div>

        <button
          onClick={() => setShareStep(null)}
          className="
          text-sm font-medium
          text-slate-500 dark:text-slate-400
          hover:text-slate-700 dark:hover:text-slate-200
          transition
        "
        >
          {language === "TE" ? "రద్దు" : "Cancel"}
        </button>
      </div>
    </div>
  </ModalPortal>
)}

      </div>
    );
    
  };
