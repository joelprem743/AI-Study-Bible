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

  type VerseTone = "COMFORT" | "WARNING" | "INSTRUCTION" | "PRAISE";

  const looksGeneric = (text: string) =>
    /feel|comfort|trust|pray|guided|strengthen|closer|walk ahead|not alone|darkness/i.test(text) ||
    text.split(" ").length < 8;
  
  // Very lightweight heuristic classifier (good enough)
const classifyVerseTone = (
  book: string,
  chapter: number
): VerseTone => {
  // Jesus' rebukes (Matthew 23, etc.)
  if (book === "Matthew" && chapter >= 23) return "WARNING";

  // Wisdom literature leans instruction
  if (book === "Proverbs") return "INSTRUCTION";

  // Psalms default to comfort/praise
  if (book === "Psalms") return "COMFORT";

  // Epistles often instruction
  if (["Romans", "Philippians"].includes(book)) return "INSTRUCTION";

  // Safe fallback
  return "COMFORT";
};

// Dynamic verse background resolver
const VERSE_BACKGROUNDS = [
  "/verse-bg/mountain-sunrise.png",
  "/verse-bg/ocean-waves.png",
  "/verse-bg/forest-path.png",
  "/verse-bg/desert-dunes.png",
  "/verse-bg/mountain-lake.png",
  "/verse-bg/sunset-fields.png",
  "/verse-bg/coastal-cliffs.png",
  "/verse-bg/autumn-forest.png",
  "/verse-bg/mountain-peak.png",
  "/verse-bg/peaceful-meadow.png",
];

function getDynamicVerseBackground(
  book: string,
  chapter: number,
  verse: number
) {
  const hash =
    book.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) +
    chapter * 31 +
    verse * 17;

  return VERSE_BACKGROUNDS[Math.abs(hash) % VERSE_BACKGROUNDS.length];
}
  const buildVerseUrl = (book: string, chapter: number, verse: number) =>
    `${window.location.origin}/#/${book}/${chapter}/${verse}`;
  
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
    const [refreshKey, setRefreshKey] = useState(0);
    const gradientPickerRef = React.useRef<HTMLDivElement | null>(null);

    const [loadingVerse, setLoadingVerse] = useState(true);
    const [loadingDevotional, setLoadingDevotional] = useState(true);
    
    type BgMode = "none" | "gradient" | "image";

    const [bgMode, setBgMode] = useState<BgMode>("none");

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
        const verseTone = classifyVerseTone(daily.book, daily.chapter);

        try {
          const verseTextForPrompt =
            verseRow?.text || `${daily.book} ${daily.chapter}:${daily.verse}`;
        
            const toneRules =
            verseTone === "WARNING"
              ? `
          WARNING / REBUKE MODE:
          - Tone must be serious and reflective
          - Do NOT attempt to comfort
          - Emphasize truth, integrity, correction, or warning
          - Avoid soft or reassuring language
          `
              : `
          COMFORT / INSTRUCTION MODE:
          - Tone may encourage or guide
          - Do NOT use clichés or vague reassurance
          `;
          
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
          - application: 2–3 short practical steps
          - NO emojis
          
          TELUGU LANGUAGE RULES (VERY IMPORTANT):
          - Use ONLY first-person plural Telugu (మనము, మన, మనకి, మనలో, మన జీవితంలో)
          - DO NOT use second-person words like:
            నీవు, నీ, నిన్ను, నువ్వు, నీకు, మాకు, మా,
          - Write as a shared reflection ("we / us"), never addressing the reader directly
          
          Language: ${language === "TE" ? "Telugu" : "English"}
          `.trim();
          
          
          
            const ai = await sendMessageToLlama(prompt, [], language, "MEDIUM");

          const jsonText = extractJsonSmart(ai.text);
          if (!jsonText) throw new Error("AI did not return JSON.");

          const parsed = JSON.parse(jsonText);

          const aiMeaning = String(parsed.meaning ?? "").trim();
          const aiApplication = String(parsed.application ?? "").trim();


          if (!aiMeaning || !aiApplication) {
            throw new Error("AI returned empty meaning/application.");
          }
          let normalizedMeaning = aiMeaning;
          let normalizedApplication = aiApplication;
          
          // Trim excessive verbosity safely
          normalizedMeaning = normalizedMeaning
            .split(/(?<=[.!?])\s+/)
            .slice(0, 3)
            .join(" ");
          
          normalizedApplication = normalizedApplication
            .split(/(?<=[.!?])\s+/)
            .slice(0, 3)
            .join(" ");
          
          // Final safety trim
          normalizedMeaning = normalizedMeaning.trim();
          normalizedApplication = normalizedApplication.trim();

          

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
          console.warn("AI devotional normalized:", err);

          if (!cancelled) {
            setMeaning(
              verseTone === "WARNING"
                ? language === "TE"
                  ? "నీవు నీ ప్రాధాన్యాలను పరిశీలించవలసి ఉంది."
                  : "You are called to examine your priorities."
                : language === "TE"
                  ? "ఈ వాక్యం నీ విశ్వాసాన్ని స్థిరపరుస్తుంది."
                  : "This verse offers steady guidance."
            );
          
            setApplication(
              verseTone === "WARNING"
                ? language === "TE"
                  ? "ఈ రోజు ఒక నిర్ణయంలో నిజాయితీని ఎంచుకో."
                  : "Choose honesty over advantage in one decision today."
                : language === "TE"
                  ? "ఈ రోజు ప్రార్థనతో ప్రారంభించు."
                  : "Begin today with prayer."
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
    }, [language, refreshKey]);

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

    useEffect(() => {
      if (bgMode === "gradient" && gradientPickerRef.current) {
        gradientPickerRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, [bgMode]);
    
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">

<div className="
bg-gradient-to-br
from-white via-slate-50 to-slate-100
dark:from-slate-900 dark:via-slate-900 dark:to-slate-950

backdrop-blur-2xl

rounded-[2.5rem]

shadow-[0_35px_100px_-20px_rgba(0,0,0,0.6)]
dark:shadow-[0_50px_140px_-20px_rgba(0,0,0,0.95)]

border border-gray dark:border-gray/10

flex flex-col
max-w-2xl w-full h-[90vh]
overflow-hidden
">
          
          {/* ✅ Header (theme match only) */}
{/* ✅ Header */}
<div className="
  px-5 sm:px-6 py-4 sm:py-5

  bg-gradient-to-r
  from-slate-900 via-slate-800 to-slate-900
  dark:from-black dark:via-slate-900 dark:to-black

  text-white

  border-b border-white/10

  shadow-sm
">

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
        className="
  w-10 h-10
  rounded-full

  bg-white/10
  hover:bg-white/20

  border border-white/10

  text-white/70 hover:text-white

  transition
  flex items-center justify-center
"
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
bg-white/40 dark:bg-white/[0.02]
backdrop-blur-md
  space-y-4
">

            
{/* Verse Card */}
<div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)]">

  {/* Background image */}
  <div
    className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-[3000ms]"
    style={{
      backgroundImage: verseRow
        ? `url(${getDynamicVerseBackground(
            verseRow.book,
            verseRow.chapter,
            verseRow.verse
          )})`
        : "none",
    }}
  />

  {/* cinematic dark overlay */}
  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/55 to-black/75" />

  {/* lighting layer */}
  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-70" />

  {/* glow layer */}
  <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 backdrop-blur-[1px]" />

  {/* content */}
  <div className="relative z-10 p-5 sm:p-6">

    {loadingVerse ? (
      <p className="text-white/70 text-sm">Loading...</p>
    ) : verseRow ? (
      <>
        <p
          className={`
            text-lg md:text-xl
            text-white
            leading-relaxed
            drop-shadow-[0_4px_15px_rgba(0,0,0,0.8)]
            ${teluguUiClass}
            ${isTeluguUI ? "font-medium tracking-[0.2px] leading-[1.9]" : "font-semibold"}
          `}
        >
          “{verseRow.text}”
        </p>

        <div className="mt-5 flex justify-between items-center">

          <p className="text-white/85 text-sm font-semibold drop-shadow-md">
            {getDisplayBookName(verseRow.book, language)}{" "}
            {verseRow.chapter}:{verseRow.verse}
          </p>

          <div className="flex items-center gap-2">

            <button
              onClick={() => {
                setBgMode("none");
                setSelectedGradient(null);
                setSelectedBackground(null);
                setShareStep("background");
              }}
              className="text-blue-300 hover:text-blue-200 text-xs font-semibold transition"
            >
              Share
            </button>

            <span className="px-3 py-1 text-[10px] rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white font-bold tracking-widest">
              DAILY VERSE
            </span>

          </div>
        </div>
      </>
    ) : (
      <p className="text-red-300 text-sm">Verse unavailable</p>
    )}

  </div>
</div>
            {/* Meaning */}
            <div className="relative p-5 sm:p-6 rounded-2xl overflow-hidden

/* LIGHT MODE — solid elevated card */
bg-white
border border-slate-200
shadow-sm

/* DARK MODE — glass card */
dark:bg-white/[0.06]
dark:border-white/10
dark:shadow-[0_12px_45px_-12px_rgba(0,0,0,0.6)]

transition-colors duration-300">

  <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-70 pointer-events-none" />
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
<div className="relative p-5 sm:p-6 rounded-2xl overflow-hidden

/* LIGHT MODE — clean elevated card */
bg-white
border border-slate-200
shadow-sm

/* DARK MODE — premium glass */
dark:bg-white/[0.06]
dark:border-white/10
dark:shadow-[0_12px_45px_-12px_rgba(0,0,0,0.6)]

transition-colors duration-300">

  <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-70 pointer-events-none" />
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
        bg-white/80 dark:bg-white/[0.04]
backdrop-blur-md
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
  meaning={meaning}
  language={language}
  verseUrl={buildVerseUrl(
    verseRow.book,
    verseRow.chapter,
    verseRow.verse
  )}
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

{/* --- BACKGROUND TYPE GRID --- */}
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5 mb-6">

  {/* Gradient option */}
  <button
  onClick={() => {
    setBgMode("gradient");
    setSelectedBackground(null);
  }}
  className={`
    relative aspect-square rounded-xl overflow-hidden border-2 transition-all
    ${bgMode === "gradient"
      ? "border-blue-600 ring-2 ring-blue-300"
      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"}
  `}
>
  {/* Base gradient */}
  <div
    className="
      absolute inset-0
      bg-gradient-to-br
      from-indigo-400 via-sky-300 to-blue-500
      dark:from-indigo-600 dark:via-sky-500 dark:to-blue-700
    "
  />

  {/* Soft vignette */}
  <div
    className="
      absolute inset-0
      bg-gradient-to-t
      from-black/25 via-transparent to-white/20
    "
  />

  {/* Subtle noise */}
  <div
    className="
      absolute inset-0
      opacity-[0.08]
      bg-[url('/noise.png')]
    "
  />

  {/* Center icon */}
  <div className="absolute inset-0 flex items-center justify-center">
    <i className="fas fa-palette text-2xl text-white/80" />
  </div>

  {/* Glass footer */}
  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm text-white text-xs py-1.5 text-center font-semibold tracking-wide">
    Gradient
  </div>
</button>


  {/* Image options */}
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
    "bible-cross",
    "blurry-grass",
    "blurry-river",
    "calm-horizon-light",
    "coastal-view",
    "dark-desert-distant-cross",
    "light-gradient-negative-cross",
    "old-bible",
    "openbible-top",
    "soft-desert",
    "soft-forest-light-rays",
    "soft-light-implied-cross",
    "soft-sky-pastel-gradient"
  ].map((id) => (
    <button
      key={id}
      onClick={() => {
        setBgMode("image");
        setSelectedBackground(`/verse-bg/${id}.png`);
        setSelectedGradient(null);
        setShareStep("content");
      }}
      className="
        relative aspect-square rounded-2xl overflow-hidden
        border border-slate-200 dark:border-slate-700
        hover:scale-[1.03] hover:shadow-lg
        transition
      "
    >
      <img
        src={`/verse-bg/${id}.png`}
        className="w-full h-full object-cover"
        alt={id}
      />
      <div className="absolute bottom-0 w-full bg-black/60 text-white text-xs py-1 text-center">
        {id.replace("-", " ")}
      </div>
    </button>
  ))}
</div>

{/* --- GRADIENT COLORS (ONLY AFTER SELECTING GRADIENT) --- */}
{bgMode === "gradient" && (
  <div ref={gradientPickerRef} className="mt-6">
    <p className="text-xs font-semibold mb-2 text-slate-600">
      {language === "TE" ? "గ్రాడియెంట్ రంగులు" : "Gradient colors"}
    </p>

    <div className="overflow-x-auto overflow-y-hidden pb-2">
      <div className="flex gap-3 flex-nowrap">
        {[
          { id: "mist", from: "#f8fafc", to: "#e2e8f0" },
          { id: "sky", from: "#e0f2fe", to: "#bae6fd" },
          { id: "meadow", from: "#ecfdf5", to: "#bbf7d0" },
          { id: "sand", from: "#fffbeb", to: "#fde68a" },
          { id: "lavender", from: "#f5f3ff", to: "#ddd6fe" },
        ].map((g) => (
          <button
            key={g.id}
            onClick={() => {
              setSelectedGradient({ from: g.from, to: g.to });
              setShareStep("content");
            }}
            className="
              w-14 h-14
              rounded-xl
              flex-shrink-0
              border
              hover:ring-2 hover:ring-blue-400
              transition
            "
            style={{
              background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
            }}
          />
        ))}
      </div>
    </div>
  </div>
)}


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

      </div>
    );
    
  };
