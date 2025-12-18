import React from "react";
import { GroupedVerses } from "@/services/bibleService";
import type { FullVerse } from "..";

/* ---------------- SAFE DEFAULT ---------------- */

const EMPTY_GROUPED_RESULTS: GroupedVerses = {
  oldTestament: {},
  newTestament: {},
};

/* ---------------- TYPES ---------------- */

interface SearchResultDisplayProps {
  groupedResults?: GroupedVerses;
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
  onOpenFilters: () => void; // ✅ REQUIRED
  englishVersion: string;
  onNavigate: (book: string, chapter: number, verse: number) => void;
}

/* ---------------- HELPERS ---------------- */

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
  onOpenFilters,
  englishVersion,
  onNavigate,
}) => {
  const { oldTestament, newTestament } = groupedResults;

  const hasResults =
    Object.keys(oldTestament).length > 0 ||
    Object.keys(newTestament).length > 0;

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* HEADER */}
      <header className="p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <h2 className="text-lg font-bold">Search Results</h2>

        <div className="flex gap-2">
          <button
            onClick={onOpenFilters}
            className="px-3 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 rounded-lg"
          >
            Filters
          </button>

          <button
            onClick={onClear}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
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
                    ? "Old Testament"
                    : "New Testament"}
                </h2>

                {Object.entries(books).map(([book, verses]) => {
                  const chapters = groupByChapter(verses);
                  const chapterNumbers = Object.keys(chapters)
                    .map(Number)
                    .sort((a, b) => a - b);

                  return (
                    <div key={book} className="mb-10">
                      <h3 className="text-2xl font-bold mb-4">{book}</h3>

                      {chapterNumbers.map(chapter => (
                        <div key={chapter} className="mb-6">
                          <h4 className="text-lg font-semibold mb-3 text-gray-600 dark:text-gray-300">
                            Chapter {chapter}
                          </h4>

                          <div className="space-y-4">
                            {chapters[chapter].map(v => {
                              const englishText =
                                v.text[englishVersion as keyof typeof v.text] ??
                                v.text.KJV;

                              return (
                                <div
                                  key={`${v.book}-${v.chapter}-${v.verse}`}
                                  className="p-3 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                                  onClick={() =>
                                    onNavigate(v.book, v.chapter, v.verse)
                                  }
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6">
                                    <div className="flex">
                                      <span className="w-8 font-bold text-gray-500">
                                        {v.verse}
                                      </span>
                                      <div
                                        dangerouslySetInnerHTML={{
                                          __html:
                                            v.text.BSI_TELUGU ??
                                            "[Telugu not available]",
                                        }}
                                      />
                                    </div>

                                    <div>{englishText}</div>
                                  </div>
                                </div>
                              );
                            })}
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
