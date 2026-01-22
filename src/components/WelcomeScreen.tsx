// src/components/WelcomeScreen.tsx
import React, { useEffect, useState } from "react";
import {
  getOrCreateDailyVerse,
  updateDailyVerse,
} from "../lib/dailyVerseService";
import { fetchVerseByRef, BibleVerseRow } from "../lib/bibleVersesService";
import { sendMessageToLlama } from "../services/geminiService";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";

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
  const [language, setLanguage] = useState<UILang>("TE");

  const [loadingVerse, setLoadingVerse] = useState(true);
  const [loadingDevotional, setLoadingDevotional] = useState(true);

  const [verseRow, setVerseRow] = useState<BibleVerseRow | null>(null);

  const [meaning, setMeaning] = useState<string>("");
  const [application, setApplication] = useState<string>("");

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
      const bibleVersion = language === "TE" ? "TELUGU_COMMUNITY_V1" : "KJV";

      try {
        const v = await fetchVerseByRef(
          daily.book,
          daily.chapter,
          daily.verse,
          bibleVersion
        );
        if (!cancelled) setVerseRow(v);
      } catch (err) {
        console.warn("Verse fetch failed, fallback to KJV:", err);

        try {
          const fallback = await fetchVerseByRef(
            daily.book,
            daily.chapter,
            daily.verse,
            "KJV"
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
- application: 2–3 short practical steps
- NO emojis
- If language is Telugu, output must be fully Telugu (no English)

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 sm:p-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 md:p-10">
        {/* Top Row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {language === "TE" ? "ఈ రోజు వాక్యం" : "Verse for Today"}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {language === "TE"
                ? "మీ రోజును దేవుని వాక్యంతో ప్రారంభించండి."
                : "Start your day with God’s Word."}
            </p>
          </div>

          <button
            onClick={toggleLanguage}
            className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            {language === "TE" ? "EN" : "తెలుగు"}
          </button>
        </div>

        {/* Verse Card */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          {loadingVerse ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {language === "TE" ? "లోడ్ అవుతోంది..." : "Loading..."}
            </p>
          ) : verseRow ? (
            <>
              <p className="text-lg md:text-xl font-medium text-slate-900 dark:text-white leading-relaxed">
                “{verseRow.text}”
              </p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 font-semibold">
                {getDisplayBookName(verseRow.book, language)} {verseRow.chapter}:
                {verseRow.verse}
              </p>
            </>
          ) : (
            <p className="text-sm text-red-500">
              {language === "TE"
                ? "వాక్యం అందుబాటులో లేదు."
                : "Verse not available."}
            </p>
          )}
        </div>

        {/* Meaning + Application */}
        <div className="mt-6 space-y-5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
              {language === "TE" ? "అర్థం" : "Meaning"}
            </h3>

            {loadingDevotional ? (
              <p className="mt-2 text-[14px] text-slate-500 dark:text-slate-400">
                {language === "TE" ? "సిద్ధమవుతోంది..." : "Preparing..."}
              </p>
            ) : (
              <p className="mt-2 text-[14px] text-slate-800 dark:text-slate-200 leading-relaxed">
                {meaning}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
              {language === "TE" ? "ఈ రోజు ఆచరణ" : "Live it today"}
            </h3>

            {loadingDevotional ? (
              <p className="mt-2 text-[14px] text-slate-500 dark:text-slate-400">
                {language === "TE" ? "సిద్ధమవుతోంది..." : "Preparing..."}
              </p>
            ) : (
              <p className="mt-2 text-[14px] text-slate-800 dark:text-slate-200 leading-relaxed">
                {application}
              </p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onDismiss}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition"
          >
            {language === "TE" ? "బైబిల్ తెరవండి" : "Open Bible"}
          </button>

          <button
            onClick={handleExplainVerse}
            disabled={!verseRow}
            className="
              px-8 py-3
              bg-white dark:bg-slate-900
              text-slate-900 dark:text-white
              font-semibold rounded-xl
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
  );
};
