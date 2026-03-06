// src/components/ProfileHighlights.tsx

import { useEffect, useState, useRef } from "react";
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

  const [filterOpen, setFilterOpen] = useState(false);
  const [bookFilter, setBookFilter] = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<string | null>(null);

  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  /* refs for outside click */
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadHighlights();
  }, []);

  /* Close filter if clicking outside */

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
        setColorPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        text-slate-900 dark:text-slate-100
        w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl
        overflow-y-auto p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}

        <div className="flex items-center justify-between mb-4">

          <h2 className="text-xl font-semibold">
            {language === "TE" ? "నా హైలైట్స్" : "My Highlights"}
          </h2>

          <div ref={filterRef} className="relative">

            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`
                flex items-center gap-2
                px-3 py-1.5 text-sm font-medium
                rounded-lg border transition
                ${
                  filterOpen
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                }
              `}
            >
              ⚙ {language === "TE" ? "ఫిల్టర్లు" : "Filters"}
            </button>

            {/* FILTER POPOVER */}

            {filterOpen && (
              <div
                className="
                absolute right-0 mt-3
                w-80
                p-5
                rounded-2xl
                border border-slate-200 dark:border-slate-700
                bg-white dark:bg-slate-900
                shadow-xl
                space-y-5
                z-50
              "
              >
                {/* BOOK FILTER */}

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {language === "TE" ? "పుస్తకం" : "Book"}
                  </label>

                  <div className="relative mt-1">

<select
  value={bookFilter ?? ""}
  onChange={(e) => setBookFilter(e.target.value || null)}
  className="
    appearance-none
    w-full
    px-3 py-2.5
    pr-9
    text-sm
    rounded-xl
    border border-slate-300 dark:border-slate-600
    bg-white dark:bg-slate-900
    focus:ring-2 focus:ring-blue-500
"
>

<option value="">
  {language === "TE" ? "అన్ని పుస్తకాలు" : "All Books"}
</option>

{BIBLE_META_WITH_VERSE_COUNTS.map((b) => (
  <option key={b.name} value={b.name}>
    {language === "TE"
      ? TELUGU_BOOK_NAMES[b.name] || b.name
      : b.name}
  </option>
))}

</select>

<div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">

<svg
  className="w-4 h-4"
  viewBox="0 0 20 20"
  fill="currentColor"
>
  <path d="M5 7l5 6 5-6H5z" />
</svg>

</div>

</div>
                </div>

                {/* COLOR FILTER */}

                <div className="relative">

                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {language === "TE" ? "రంగు" : "Highlight Color"}
                  </label>

                  <button
                    onClick={() => setColorPickerOpen((v) => !v)}
                    className="
                    mt-1 w-full
                    flex items-center justify-between
                    px-3 py-2.5 text-sm
                    rounded-xl
                    border border-slate-300 dark:border-slate-600
                    bg-white dark:bg-slate-900
                  "
                  >
                    <div className="flex items-center gap-2">

                      {colorFilter ? (
                        <span
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: COLOR_MAP[colorFilter] }}
                        />
                      ) : (
                        "🎨"
                      )}

                      <span>
                        {colorFilter
                          ? colorFilter.charAt(0).toUpperCase() +
                            colorFilter.slice(1)
                          : language === "TE"
                          ? "అన్ని రంగులు"
                          : "All colors"}
                      </span>

                    </div>

                    <svg
  className={`w-4 h-4 text-slate-400 transition ${
    colorPickerOpen ? "rotate-180" : ""
  }`}
  viewBox="0 0 20 20"
  fill="currentColor"
>
  <path d="M5 7l5 6 5-6H5z" />
</svg>
                  </button>

                  {colorPickerOpen && (
                    <div
                      className="
                      absolute mt-2
                      w-full
                      p-4
                      rounded-xl
                      border border-slate-200 dark:border-slate-700
                      bg-white dark:bg-slate-900
                      shadow-xl
                    "
                    >
                      <div className="flex justify-between mb-3">

                        {Object.entries(COLOR_MAP).map(([name, hex]) => (
                          <button
                            key={name}
                            onClick={() => {
                              setColorFilter(name);
                              setColorPickerOpen(false);
                            }}
                            className={`
                              w-9 h-9 rounded-full border
                              ${
                                colorFilter === name
                                  ? "ring-2 ring-blue-500"
                                  : "border-slate-300 dark:border-slate-600"
                              }
                            `}
                            style={{ backgroundColor: hex }}
                          />
                        ))}

                      </div>

                      <button
                        onClick={() => {
                          setColorFilter(null);
                          setColorPickerOpen(false);
                        }}
                        className="
                        w-full py-2
                        rounded-xl text-sm
                        border border-slate-300 dark:border-slate-600
                      "
                      >
                        {language === "TE" ? "🎨 అన్ని రంగులు": "🎨 All colours"}
                      </button>

                    </div>
                  )}

                </div>

                {/* CLEAR */}

                <button
                  onClick={() => {
                    setBookFilter(null);
                    setColorFilter(null);
                  }}
                  className="
                  text-xs font-semibold
                  px-3 py-1.5
                  rounded-lg
                  border border-slate-300 dark:border-slate-600
                "
                >
                  {language === "TE" ? "ఫిల్టర్లు తొలగించు" : "Clear Filters"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CONTENT */}

        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : (
          (["OLD", "NEW"] as const).map((testament) => {
            const books = grouped[testament];

            const filteredBooks: Record<string, Record<number, HighlightRow[]>> = {};

            Object.entries(books).forEach(([book, chapters]) => {

              if (bookFilter && book !== bookFilter) return;

              Object.entries(chapters).forEach(([chapter, verses]) => {

                const filteredVerses = verses.filter(
                  (v) => !colorFilter || v.color === colorFilter
                );

                if (!filteredVerses.length) return;

                if (!filteredBooks[book]) filteredBooks[book] = {};
                filteredBooks[book][Number(chapter)] = filteredVerses;

              });
            });

            if (!Object.keys(filteredBooks).length) return null;

            return (
              <div key={testament} className="mb-8">

                <div
                  className="mb-4 px-3 py-2
                  bg-gray-100 dark:bg-slate-800/60
                  border-l-4 border-indigo-500
                  text-xs font-bold uppercase"
                >
                  {language === "TE"
                    ? testament === "OLD"
                      ? "పాత నిబంధన"
                      : "క్రొత్త నిబంధన"
                    : testament === "OLD"
                    ? "Old Testament"
                    : "New Testament"}
                </div>

                {sortBooksByBibleOrder(filteredBooks).map((book) => (

                  <div key={book} className="mb-5">

                    <h3 className="text-lg font-semibold">
                      {language === "TE"
                        ? TELUGU_BOOK_NAMES[book] || book
                        : book}
                    </h3>

                    {Object.keys(filteredBooks[book])
                      .sort((a, b) => Number(a) - Number(b))
                      .map((chapter) => (

                        <div key={chapter} className="ml-4 mt-2">

                          <div className="text-sm opacity-70">
                            {language === "TE" ? "అధ్యాయం" : "Chapter"} {chapter}
                          </div>

                          <div className="space-y-2 mt-1">

                            {filteredBooks[book][Number(chapter)].map((h) => (
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
          className="px-4 py-2 rounded-xl
          bg-gradient-to-r from-blue-600 to-indigo-600
          text-white shadow-md"
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

    if (verseCache[key]) {
      setText(verseCache[key]);
      return;
    }

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
      className="
      w-full text-left px-3 py-2 rounded-lg
      bg-white dark:bg-slate-800
      border border-gray-200 dark:border-slate-700
      hover:shadow
    "
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

      <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
        {text}
      </p>
    </button>
  );
}