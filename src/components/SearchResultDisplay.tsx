import React from "react";
import { GroupedVerses } from "@/services/bibleService";
import type { FullVerse } from "..";
import { TELUGU_BOOK_NAMES } from "@/data/teluguBookNames";

/* ---------------- SAFE DEFAULT ---------------- */

const TELUGU_VERSION_KEY = "TELUGU_COMMUNITY_V1";


const EMPTY_GROUPED_RESULTS: GroupedVerses = {
  oldTestament: {},
  newTestament: {},
};

const TESTAMENT_LABELS = {
  EN: {
    old: "Old Testament",
    new: "New Testament",
  },
  TE: {
    old: "పాత నిబంధన",
    new: "కొత్త నిబంధన",
  },
};

const CHAPTER_LABELS = {
  EN: "Chapter",
  TE: "అధ్యాయం",
};


/* ---------------- TYPES ---------------- */

interface SearchResultDisplayProps {
  groupedResults?: GroupedVerses;
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
  searchQuery: string;

  onOpenFilters: () => void; // ✅ REQUIRED
  englishVersion: string;
  studyMode: "single" | "parallel"; 
  onNavigate: (book: string, chapter: number, verse: number) => void;
}

/* ---------------- HELPERS ---------------- */
function highlight(text: string, query: string) {
  if (!query) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(
    new RegExp(`(${safe})`, "giu"),
    "<mark>$1</mark>"
  );
}


function getDisplayBookName(book: string, isTelugu: boolean) {
  if (!isTelugu) return book;
  return TELUGU_BOOK_NAMES[book] ?? book;
}

function getSearchDisplayText(
  verse: FullVerse,
  version: string,
  query: string
): string {
  const text =
    version === TELUGU_VERSION_KEY
      ? verse.text.TELUGU_COMMUNITY_V1
      : verse.text[version as keyof typeof verse.text];

  if (!text) return "";

  return highlight(text, query);
}



function groupByChapter(verses: FullVerse[]) {
  const map: Record<number, FullVerse[]> = {};

  for (const v of verses) {
    if (!map[v.chapter]) map[v.chapter] = [];
    map[v.chapter].push(v);
  }

  for (const ch of Object.keys(map)) {
    map[+ch].sort((a, b) => a.verse - b.verse);
  }

  return map;
}

/* ---------------- SKELETON ---------------- */

const SearchSkeleton: React.FC = () => (
  <div className="mb-8 animate-pulse">
    <div className="h-8 bg-gray-300 dark:bg-gray-800 rounded w-1/3 mb-6" />
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-2 md:gap-6 p-3">
          <div className="flex">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-8 mr-2" />
            <div className="space-y-2 flex-grow">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full" />
            </div>
          </div>
          <div className="hidden md:flex">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ---------------- COMPONENT ---------------- */

export const SearchResultDisplay: React.FC<SearchResultDisplayProps> = ({
  groupedResults = EMPTY_GROUPED_RESULTS,
  isLoading,
  error,
  onClear,
  searchQuery, 
  onOpenFilters,
  englishVersion,
  studyMode, 
  onNavigate,
}) => {



  const { oldTestament, newTestament } = groupedResults;
  const isTeluguMode = englishVersion === TELUGU_VERSION_KEY;

  const chapterLabel = isTeluguMode
  ? CHAPTER_LABELS.TE
  : CHAPTER_LABELS.EN;


const labels = isTeluguMode
  ? TESTAMENT_LABELS.TE
  : TESTAMENT_LABELS.EN;


  const hasResults =
    Object.keys(oldTestament).length > 0 ||
    Object.keys(newTestament).length > 0;

    const resultCount = React.useMemo(() => {
      let count = 0;
    
      for (const books of [oldTestament, newTestament]) {
        for (const verses of Object.values(books)) {
          count += verses.length;
        }
      }
    
      return count;
    }, [oldTestament, newTestament]);
    

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-[#0B0F14]">

      {/* HEADER */}
      <header className="
  p-3
  bg-white/90 dark:bg-slate-950/80
  backdrop-blur-xl
  border-b border-slate-200 dark:border-white/10
  shadow-sm
  flex items-center justify-between
  sticky top-0 z-10
">

      <h2 className="text-lg font-bold">
  Search Results
  {!isLoading && hasResults && (
    <span className="ml-2 text-sm font-normal text-gray-500">
      ({resultCount})
    </span>
  )}
</h2>


        <div className="flex gap-2">
          <button
            onClick={onOpenFilters}
            className="
  px-3 py-2 text-sm font-medium rounded-xl
  bg-slate-100 hover:bg-slate-200
  dark:bg-slate-900 dark:hover:bg-slate-800
  border border-slate-200 dark:border-white/10
  text-slate-700 dark:text-slate-200
  transition
"

          >
            Filters
          </button>

          <button
            onClick={onClear}
            className="
  px-4 py-2 text-sm font-semibold
  text-white
  bg-gradient-to-r from-blue-600 to-indigo-600
  rounded-xl
  shadow-md
  hover:shadow-lg
  transition
"

          >
            Back to Bible
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex-grow overflow-y-auto p-4 md:p-6">
        {isLoading && (
          <>
            <SearchSkeleton />
            <SearchSkeleton />
          </>
        )}

        {error && (
          <div className="text-center text-red-500 font-semibold">
            {error}
          </div>
        )}

        {!isLoading && !error && !hasResults && (
          <div className="text-center text-gray-500">
            No results found for your query.
          </div>
        )}
        {!isLoading && hasResults && (
  <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
    {resultCount} result{resultCount !== 1 ? "s" : ""} found
  </div>
)}


        {!isLoading &&
          !error &&
          ([
            ["oldTestament", oldTestament],
            ["newTestament", newTestament],
          ] as const).map(([testamentKey, books]) => {
            if (Object.keys(books).length === 0) return null;

            return (
              <div key={testamentKey} className="mb-12">
                <h2 className="text-3xl font-extrabold mb-6 text-blue-700 dark:text-blue-400">
                {testamentKey === "oldTestament"
  ? labels.old
  : labels.new}

                </h2>

                {Object.entries(books).map(([book, verses]) => {
                  const chapters = groupByChapter(verses);
                  const chapterNumbers = Object.keys(chapters)
                    .map(Number)
                    .sort((a, b) => a - b);

                  return (
                    <div key={book} className="mb-10">
                      <h3 className="text-2xl font-bold mb-4">
  {getDisplayBookName(book, isTeluguMode)}
</h3>


                      {chapterNumbers.map(chapter => (
                        <div key={chapter} className="mb-6">
                          <h4 className="text-lg font-semibold mb-3 text-gray-600 dark:text-gray-300">
  {chapterLabel} {chapter}
</h4>


                          <div className="space-y-4">
                          {chapters[chapter].map(v => (
  <div
    key={`${v.book}-${v.chapter}-${v.verse}`}
    className="
  p-4 rounded-2xl
  bg-white dark:bg-slate-900
  border border-slate-200 dark:border-white/10
  shadow-sm
  hover:bg-slate-50 dark:hover:bg-slate-800/50
  hover:shadow-md
  cursor-pointer
  transition-all duration-150
"

    onClick={() => onNavigate(v.book, v.chapter, v.verse)}
  >
<div className="flex">
  <span className="w-8 font-bold text-gray-500">
    {v.verse}
  </span>

  {(() => {
  const html = getSearchDisplayText(v, englishVersion, searchQuery);
  return html ? (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  ) : null;
})()}

</div>

  </div>
))}


                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
      </div>
    </div>
  );
};