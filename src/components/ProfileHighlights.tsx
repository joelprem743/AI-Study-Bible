// src/components/ProfileHighlights.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchVersesByReferences } from "../services/bibleService";
import { useAuth } from "../context/AuthContext";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import { BIBLE_META_WITH_VERSE_COUNTS } from "../data/bibleMetaWithVerseCounts";

/* ------------------ Testament helpers ------------------ */
const TELUGU_VERSION_KEY = "TELUGU_COMMUNITY_V1";

const BOOK_INDEX = new Map<string, number>();
BIBLE_META_WITH_VERSE_COUNTS.forEach((b, i) =>
  BOOK_INDEX.set(b.name, i)
);

function getTestament(book: string): "OLD" | "NEW" {
  const idx = BOOK_INDEX.get(book);
  return idx !== undefined && idx < 39 ? "OLD" : "NEW";
}

function sortBooksByBibleOrder(books: Record<string, any>) {
  return Object.keys(books).sort((a, b) => {
    const ia = BOOK_INDEX.get(a) ?? 999;
    const ib = BOOK_INDEX.get(b) ?? 999;
    return ia - ib;
  });
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

    setGrouped(groupedBooks);
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700
                   w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl
                   overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">
          {language === "TE" ? "నా హైలైట్స్" : "My Highlights"}
        </h2>

        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : (
          (["OLD", "NEW"] as const).map((testament) => {
            const books = grouped[testament];
            if (!books || Object.keys(books).length === 0) return null;

            return (
              <div key={testament} className="mb-8">
                <div className="mb-4 px-3 py-2 bg-gray-100 dark:bg-slate-800/60
                                border-l-4 border-indigo-500 text-xs font-bold uppercase">
                  {language === "TE"
                    ? testament === "OLD"
                      ? "పాత నిబంధన"
                      : "క్రొత్త నిబంధన"
                    : testament === "OLD"
                    ? "Old Testament"
                    : "New Testament"}
                </div>

                {sortBooksByBibleOrder(books).map((book) => (
                  <div key={book} className="mb-5">
                    <h3 className="text-lg font-semibold">
                      {language === "TE"
                        ? TELUGU_BOOK_NAMES[book] || book
                        : book}
                    </h3>

                    {Object.keys(books[book])
                      .sort((a, b) => Number(a) - Number(b))
                      .map((chapter) => (
                        <div key={chapter} className="ml-4 mt-2">
                          <div className="text-sm opacity-70">
                            {language === "TE" ? "అధ్యాయం" : "Chapter"}{" "}
                            {chapter}
                          </div>

                          <div className="space-y-2 mt-1">
                            {books[book][Number(chapter)].map((h) => (
                              <HighlightItem
                                key={`${book}-${chapter}-${h.verse}`}
                                highlight={h}
                                language={language}
                                bibleVersion={bibleVersion}
                                onClose={onClose}
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
          className="mt-4 px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300
                     dark:bg-slate-700 dark:hover:bg-slate-600 rounded"
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

const verseCache: Record<string, string> = {};

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
    if (verseCache[key]) return setText(verseCache[key]);

    const res = await fetchVersesByReferences([
      {
        book: highlight.book,
        chapter: highlight.chapter,
        startVerse: highlight.verse,
        endVerse: highlight.verse,
      },
    ]);

    const v = res?.[0];
    if (!v?.text) return;

    const t =
  typeof v.text === "string"
    ? v.text
    : v.text[bibleVersion as keyof typeof v.text] ??
      v.text.KJV ??
      "";


    verseCache[key] = t;
    setText(t);
  }

  const goToVerse = () => {
    window.location.hash = `#/${highlight.book}/${highlight.chapter}/${highlight.verse}`;
    onClose();
  };

  return (
    <button
      onClick={goToVerse}
      className="w-full text-left px-3 py-2 rounded-lg
                 bg-white dark:bg-slate-800
                 border border-gray-200 dark:border-slate-700
                 hover:shadow transition"
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3 rounded"
          style={{ backgroundColor: COLOR_MAP[highlight.color] }}
        />
        <span className="text-sm font-semibold">
          {language === "TE"
            ? `${TELUGU_BOOK_NAMES[highlight.book] || highlight.book} ${highlight.chapter}:${highlight.verse}`
            : `${highlight.book} ${highlight.chapter}:${highlight.verse}`}
        </span>
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
        {text}
      </p>
    </button>
  );
}
