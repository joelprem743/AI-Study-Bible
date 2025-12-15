// src/components/ProfileHighlights.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchVersesByReferences } from "../services/bibleService";
import { useAuth } from "../context/AuthContext";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import { BIBLE_META_WITH_VERSE_COUNTS } from "../data/bibleMetaWithVerseCounts";

/* ------------------ Testament helpers ------------------ */

const BOOK_INDEX = new Map<string, number>();
BIBLE_META_WITH_VERSE_COUNTS.forEach((b, i) => BOOK_INDEX.set(b.name, i));

function getTestament(book: string): "OLD" | "NEW" {
  const idx = BOOK_INDEX.get(book);
  return idx !== undefined && idx < 39 ? "OLD" : "NEW";
}

/* ------------------ Types ------------------ */

interface HighlightRow {
  book: string;
  chapter: number;
  verse: number;
  color: string;
}

interface Props {
  userId: string;
  onClose: () => void;
  bibleVersion: string;
}

interface GroupedHighlights {
  OLD: Record<string, Record<number, HighlightRow[]>>;
  NEW: Record<string, Record<number, HighlightRow[]>>;
}

/* ------------------ Color map ------------------ */

const COLOR_MAP: Record<string, string> = {
  yellow: "#FDE047",
  green: "#86EFAC",
  pink: "#FDA4AF",
  blue: "#7DD3FC",
};

/* ================== COMPONENT ================== */

export default function ProfileHighlights({
  userId,
  onClose,
  bibleVersion,
}: Props) {
  const { language } = useAuth();

  const [highlights, setHighlights] = useState<HighlightRow[]>([]);
  const [grouped, setGrouped] = useState<GroupedHighlights>({
    OLD: {},
    NEW: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHighlights();
  }, []);

  async function loadHighlights() {
    setLoading(true);

    const { data, error } = await supabase
      .from("highlights")
      .select("book, chapter, verse, color")
      .eq("user_id", userId)
      .order("book")
      .order("chapter")
      .order("verse");

    if (error) {
      console.error("Failed to load highlights", error);
      setLoading(false);
      return;
    }

    const groupedBooks: GroupedHighlights = { OLD: {}, NEW: {} };

    (data || []).forEach((h) => {
      const testament = getTestament(h.book);

      if (!groupedBooks[testament][h.book]) {
        groupedBooks[testament][h.book] = {};
      }

      if (!groupedBooks[testament][h.book][h.chapter]) {
        groupedBooks[testament][h.book][h.chapter] = [];
      }

      groupedBooks[testament][h.book][h.chapter].push(h);
    });

    setHighlights(data || []);
    setGrouped(groupedBooks);
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          My Highlights
        </h2>

        {loading ? (
          <div className="text-gray-700 dark:text-gray-300">Loading…</div>
        ) : highlights.length === 0 ? (
          <div className="text-gray-600 dark:text-gray-400">
            You have no highlights yet.
          </div>
        ) : (
          (["OLD", "NEW"] as const).map((testament) => {
            const books = grouped[testament];
            if (!books || Object.keys(books).length === 0) return null;

            return (
              <div key={testament} className="mb-8">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
                  {language === "TE"
                    ? testament === "OLD"
                      ? "పాత నిబంధన"
                      : "క్రొత్త నిబంధన"
                    : testament === "OLD"
                    ? "Old Testament"
                    : "New Testament"}
                </h2>

                {Object.keys(books).map((book) => (
                  <div key={book} className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-blue-300 mb-2">
                      {language === "TE"
                        ? TELUGU_BOOK_NAMES[book] || book
                        : book}
                    </h3>

                    {Object.keys(books[book]).map((chapter) => (
                      <div key={chapter} className="ml-4 mb-4">
                        <h4 className="text-sm text-gray-700 dark:text-gray-400 mb-1 font-medium">
                          {language === "TE" ? "అధ్యాయం" : "Chapter"} {chapter}
                        </h4>

                        <div className="space-y-2">
                          {books[book][Number(chapter)].map((h) => (
                            <HighlightItem
                              key={`${book}-${chapter}-${h.verse}`}
                              highlight={h}
                              onClose={onClose}
                              language={language}
                              bibleVersion={bibleVersion}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })
        )}

        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-gray-100 rounded-md"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ================== ITEM ================== */

interface ItemProps {
  highlight: HighlightRow;
  onClose: () => void;
  language: "EN" | "TE";
  bibleVersion: string;
}

const chapterCache: Record<string, any[]> = {};

function HighlightItem({
  highlight,
  onClose,
  language,
  bibleVersion,
}: ItemProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    loadText();
  }, [language, bibleVersion]);

  async function loadText() {
    const key = `${highlight.book}-${highlight.chapter}-${highlight.verse}-${bibleVersion}`;

    if (!chapterCache[key]) {
      chapterCache[key] = await fetchVersesByReferences([
        {
          book: highlight.book,
          chapter: highlight.chapter,
          startVerse: highlight.verse,
          endVerse: highlight.verse,
        },
      ]);
    }

    const verseObj = chapterCache[key]?.[0];
    if (!verseObj?.text) return setText("");

    const raw = verseObj.text;

    if (typeof raw === "string") return setText(raw);

    if (bibleVersion === "BSI_TELUGU") {
      return setText(raw.BSI_TELUGU || "");
    }

    setText(raw.KJV || raw.ESV || raw.NIV || "");
  }

  const goToVerse = () => {
    window.location.hash = `#/${encodeURIComponent(
      highlight.book
    )}/${highlight.chapter}/${highlight.verse}`;
    onClose();
  };

  return (
    <button
      onClick={goToVerse}
      className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md border border-gray-300 dark:border-slate-700 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3 rounded"
          style={{ backgroundColor: COLOR_MAP[highlight.color] }}
        />

        <span className="font-semibold text-sm text-gray-800 dark:text-blue-200">
          {language === "TE"
            ? `${TELUGU_BOOK_NAMES[highlight.book] || highlight.book} ${highlight.chapter}:${highlight.verse}`
            : `${highlight.book} ${highlight.chapter}:${highlight.verse}`}
        </span>
      </div>

      <p className="text-xs text-gray-700 dark:text-slate-300 truncate">
        {text}
      </p>
    </button>
  );
}
