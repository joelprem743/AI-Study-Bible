import React, { useEffect, useRef, useCallback } from 'react';
import type { Verse, VerseReference } from '../types';
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
  onScrollDirectionChange?: (direction: 'up' | 'down') => void; 
}

const VerseSkeleton: React.FC = () => (
  <div className="p-3 rounded-lg animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6">
      <div className="flex">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-8 mr-2"></div>
        <div className="space-y-2 flex-grow">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
      <div className="hidden md:flex">
        <div className="space-y-2 flex-grow">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
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
  onScrollDirectionChange
}) => {

  useEffect(() => {
    if (
      selectedVerseRef &&
      selectedVerseRef.book === bookName &&
      selectedVerseRef.chapter === chapterNum
    ) {
      setTimeout(() => {
        const verseElement = document.getElementById(`verse-${selectedVerseRef.verse}`);
        if (verseElement) {
          verseElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 100);
    }
  }, [selectedVerseRef, bookName, chapterNum, verses]);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const MIN_SWIPE_DISTANCE = 75;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = 0;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {


    touchStartX.current = 0;
    touchEndX.current = 0;
  };
  const lastScrollTop = useRef(0);
  const SCROLL_THRESHOLD = 50; // Minimum pixels to scroll before triggering action

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      if (!onScrollDirectionChange) return;

      const currentScrollTop = e.currentTarget.scrollTop;
      const delta = Math.abs(currentScrollTop - lastScrollTop.current);

      // If at the very top, always show navigation
      if (currentScrollTop < 10) {
          onScrollDirectionChange('up');
          lastScrollTop.current = currentScrollTop;
          return;
      }

      // Ignore small scroll movements to prevent jitter
      if (delta < SCROLL_THRESHOLD) return;

      if (currentScrollTop > lastScrollTop.current) {
          // Scrolling Down -> Hide Nav
          onScrollDirectionChange('down');
      } else {
          // Scrolling Up -> Show Nav
          onScrollDirectionChange('up');
      }

      lastScrollTop.current = currentScrollTop;
  }, [onScrollDirectionChange]);

  if (isLoading) {
    return (
      <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900">
        <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => <VerseSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-semibold">Error</p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-grow overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onScroll={handleScroll}
    >

      {/* MOBILE HEADER (unchanged as per your instruction) */}
      <div className="md:hidden text-center mb-3 pb-2 border-b border-gray-300 dark:border-gray-700">
        <h2
          className="
            text-base font-normal text-gray-900 dark:text-gray-100 font-telugu 
            leading-tight px-3 truncate
          "
        >
          {TELUGU_BOOK_NAMES[bookName]} – {bookName} {chapterNum}
        </h2>
      </div>

      {/* DESKTOP HEADER — PERFECTLY CENTERED TWO-COLUMN */}
      <div className="hidden md:grid md:grid-cols-2 w-full mb-4 pb-3 border-b border-gray-300 dark:border-gray-700">

        {/* Telugu centered */}
        <div className="flex justify-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-telugu">
            {TELUGU_BOOK_NAMES[bookName]} {chapterNum}
          </h2>
        </div>

        {/* English centered */}
        <div className="flex justify-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {bookName} {chapterNum}
          </h2>
        </div>

      </div>

      {/* VERSES */}
      <div className="space-y-4">
        {verses.map(verse => {
          const isSelected =
            selectedVerseRef?.book === bookName &&
            selectedVerseRef?.chapter === chapterNum &&
            selectedVerseRef?.verse === verse.verse;

          const englishText =
            verse.text[englishVersion as keyof typeof verse.text] ||
            verse.text.KJV;

          return (
            <div
              id={`verse-${verse.verse}`}
              key={verse.verse}
              onClick={() => onVerseSelect(verse.verse)}
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6">

                {/* TELUGU COLUMN */}
                <div className="flex">
                  <span className="text-sm font-bold w-8 text-gray-500 dark:text-gray-400">
                    {verse.verse}
                  </span>
                  <div>
                    {verse.text.BSI_TELUGU ? (
                      <p className="text-base leading-relaxed font-telugu">
                        {verse.text.BSI_TELUGU}
                      </p>
                    ) : (
                      <p className="text-sm italic text-gray-500 dark:text-gray-400">
                        [Telugu translation not available]
                      </p>
                    )}
                  </div>
                </div>

                {/* ENGLISH COLUMN */}
                <div className="flex mt-2 md:mt-0">
                  <span className="text-sm font-bold w-8 text-gray-500 dark:text-gray-400 md:hidden">
                    {verse.verse}
                  </span>
                  <p className="text-[1.05rem] leading-[1.55]">
                    {englishText}
                  </p>
                </div>

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
