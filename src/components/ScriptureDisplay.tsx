// src/components/ScriptureDisplay.tsx
import React, { useEffect, useRef, useCallback } from "react";
import type { Verse, VerseReference } from "../types";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";

interface ScriptureDisplayProps {
  bookName: string;
  chapterNum: number;
  verses: Verse[];
  isLoading: boolean;
  error: string | null;
  englishVersion: string;
  onVerseSelect: (verseNum: number) => void;
  selectedVerseRef: VerseReference | null;
  onNextChapter: () => void;
  onPreviousChapter: () => void;
  onScrollDirectionChange?: (direction: "up" | "down") => void;
  highlights: { [verse: number]: string };
}

const VerseSkeleton: React.FC = () => (
  <div className="p-3 rounded-lg animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 p-3">
      <div className="flex">
        <div className="h-4 bg-gray-300 dark:bg-[#1A1D21] rounded w-8 mr-2" />
        <div className="space-y-2 flex-grow">
          <div className="h-4 bg-gray-300 dark:bg-[#1A1D21] rounded w-full" />
          <div className="h-4 bg-gray-300 dark:bg-[#1A1D21] rounded w-5/6" />
        </div>
      </div>
      <div className="hidden md:flex">
        <div className="space-y-2 flex-grow">
          <div className="h-4 bg-gray-300 dark:bg-[#1A1D21] rounded w-full" />
          <div className="h-4 bg-gray-300 dark:bg-[#1A1D21] rounded w-3/4" />
        </div>
      </div>
    </div>
  </div>
);

export const ScriptureDisplay: React.FC<ScriptureDisplayProps> = ({
  bookName,
  chapterNum,
  verses,
  isLoading,
  error,
  englishVersion,
  onVerseSelect,
  selectedVerseRef,
  onNextChapter,
  onPreviousChapter,
  onScrollDirectionChange,
  highlights,
}) => {
  const getHighlightClasses = (color: string) => {
    switch (color) {
      case "yellow":
        return "bg-yellow-200/50 dark:bg-yellow-400/15";
      case "green":
        return "bg-green-200/50 dark:bg-green-400/15";
      case "pink":
        return "bg-rose-200/50 dark:bg-rose-400/15";
      case "blue":
        return "bg-sky-200/50 dark:bg-sky-400/15";
      default:
        return "";
    }
  };

  // auto-scroll to selected verse
  useEffect(() => {
    if (
      selectedVerseRef &&
      selectedVerseRef.book === bookName &&
      selectedVerseRef.chapter === chapterNum
    ) {
      setTimeout(() => {
        const verseElement = document.getElementById(
          `verse-${selectedVerseRef.verse}`
        );
        if (verseElement) {
          verseElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);
    }
  }, [selectedVerseRef, bookName, chapterNum, verses]);

  const lastScrollTop = useRef(0);
  const SCROLL_THRESHOLD = 50;

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!onScrollDirectionChange) return;

      const currentScrollTop = e.currentTarget.scrollTop;
      const delta = Math.abs(currentScrollTop - lastScrollTop.current);

      if (currentScrollTop < 10) {
        onScrollDirectionChange("up");
        lastScrollTop.current = currentScrollTop;
        return;
      }

      if (delta < SCROLL_THRESHOLD) return;

      if (currentScrollTop > lastScrollTop.current) {
        onScrollDirectionChange("down");
      } else {
        onScrollDirectionChange("up");
      }

      lastScrollTop.current = currentScrollTop;
    },
    [onScrollDirectionChange]
  );

  if (isLoading) {
    return (
      <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-[#111418]">
        <div className="h-8 bg-gray-300 dark:bg-[#1A1D21] rounded w-1/3 mb-4 animate-pulse" />
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <VerseSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-[#111418] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-semibold">Error</p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-grow overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-[#111418]"
      onScroll={handleScroll}
    >
      {/* Mobile header */}
      <div className="md:hidden text-center mb-3 pb-2 border-b border-gray-300 dark:border-[#2A2F35]">
        <h2 className="text-base font-normal text-gray-900 dark:text-gray-100 font-telugu leading-tight px-3 truncate">
          {TELUGU_BOOK_NAMES[bookName]} – {bookName} {chapterNum}
        </h2>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:grid md:grid-cols-2 w-full mb-4 pb-3 border-b border-gray-300 dark:border-[#2A2F35]">
        <div className="flex justify-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-telugu">
            {TELUGU_BOOK_NAMES[bookName]} {chapterNum}
          </h2>
        </div>
        <div className="flex justify-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {bookName} {chapterNum}
          </h2>
        </div>
      </div>

      {/* VERSES */}
      <div className="space-y-4">
        {verses.map((verse) => {
          const isHighlighted = highlights[verse.verse] !== undefined;
          const color = highlights[verse.verse];

          const englishText =
            verse.text[englishVersion as keyof typeof verse.text] ||
            verse.text.KJV;

          return (
            <div
              id={`verse-${verse.verse}`}
              key={verse.verse}
              onClick={() => onVerseSelect(verse.verse)} // only selects verse, no highlight logic
              className="rounded-lg transition-all duration-200"
            >
              <div
  className={`
    grid grid-cols-1 md:grid-cols-2 md:gap-6 p-3 rounded-lg cursor-pointer transition-all duration-200
    ${isHighlighted ? getHighlightClasses(color) : ""}
    ${
      selectedVerseRef?.verse === verse.verse
        ? "border-2 border-gray-300 dark:border-gray-500"
        : "hover:bg-gray-200 dark:hover:bg-[#1A1D21]"
    }
  `}
>

                {/* TELUGU */}
                <div className="flex">
                  <span className="text-sm font-bold w-8 text-gray-500 dark:text-gray-400 select-none">
                    {verse.verse}
                  </span>
                  <p className="text-base leading-relaxed font-telugu">
                    {verse.text.BSI_TELUGU || (
                      <span className="text-sm italic text-gray-500 dark:text-gray-400">
                        [Telugu translation not available]
                      </span>
                    )}
                  </p>
                </div>

                {/* ENGLISH */}
                <div className="flex mt-2 md:mt-0">
                  <span className="text-sm font-bold w-8 text-gray-500 dark:text-gray-400 md:hidden select-none">
                    {verse.verse}
                  </span>
                  <p className="text-[1.05rem] leading-[1.55]">{englishText}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
