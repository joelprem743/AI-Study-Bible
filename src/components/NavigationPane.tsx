import React, { useState } from "react";
import { BIBLE_META } from "../data/bibleMeta";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import ModalPortal from "./ModalPortal";

interface Props {
  books: string[];
  selectedBook: string;
  selectedChapter: number;
  chapterCount: number; 
  onBookChange: (book: string) => void;
  onChapterChange: (chapter: number) => void;
  englishVersion: string;
  onEnglishVersionChange: (version: string) => void;
  englishVersions: string[];
  onNextChapter: () => void;
  onPreviousChapter: () => void;
  isFirstChapterOfBible: boolean;
  isLastChapterOfBible: boolean;
}

export default function NavigationPane(props: Props) {
  const {
    books,
    selectedBook,
    selectedChapter,
    onBookChange,
    onChapterChange,
    englishVersion,
    onEnglishVersionChange,
    englishVersions,
    onNextChapter,
    onPreviousChapter,
    isFirstChapterOfBible,
    isLastChapterOfBible,
  } = props;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [selectionStep, setSelectionStep] = useState<"BOOK" | "CHAPTER">("BOOK");
  const [tempBook, setTempBook] = useState(selectedBook);

  const tempMeta = BIBLE_META.find((b) => b.name === tempBook);
  const tempChapterCount = tempMeta ? tempMeta.chapters : 0;

  const unifiedLabel = `${selectedBook} ${selectedChapter}`;

  const handleOpenModal = () => {
    setTempBook(selectedBook);
    setSelectionStep("BOOK");
    setIsModalOpen(true);
  };

  const handleBookSelect = (book: string) => {
    setTempBook(book);
    setSelectionStep("CHAPTER");
  };

  const handleChapterSelect = (chapter: number) => {
    onBookChange(tempBook);
    onChapterChange(chapter);
    setIsModalOpen(false);
  };

  return (
    <div className="p-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-[#2A2F35] shadow-sm">

      <div className="flex items-center w-full gap-3">

        {/* UNIFIED BUTTON */}
        <div
  className="
    group flex flex-1 items-center justify-between
    bg-gray-50 dark:bg-gray-800
    border border-gray-300 dark:border-[#2A2F35]
    rounded-xl px-3 py-2
    transform-gpu transition-all duration-150 ease-out
    hover:scale-[1.03] active:scale-[0.985]
    hover:shadow-[0_0_8px_rgba(59,130,246,0.35)]
    dark:hover:shadow-[0_0_10px_rgba(59,130,246,0.45)]
  "
>


          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreviousChapter();
            }}
            disabled={isFirstChapterOfBible}
            className="
              h-full flex items-center justify-center
              text-gray-500 dark:text-[#E5E5E5] disabled:opacity-30
              text-sm md:text-base px-3 z-10 pointer-events-auto
            "
          >
            <i className="fas fa-caret-left no-scale-icon" />
          </button>

          <div className="flex-1 h-full flex items-center justify-center z-20">
            <button
              onClick={handleOpenModal}
              title={unifiedLabel}
              className="
                text-sm font-medium w-full h-full flex items-center justify-center
                text-gray-900 dark:text-[#E5E5E5] md:text-base 
                whitespace-nowrap overflow-hidden text-ellipsis px-2
              "
            >
              {unifiedLabel}
            </button>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onNextChapter();
            }}
            disabled={isLastChapterOfBible}
            className="
              h-full flex items-center justify-center
              text-gray-500 dark:text-gray-300 disabled:opacity-30
              text-sm md:text-base px-3 z-10 pointer-events-auto
            "
          >
            <i className="fas fa-caret-right no-scale-icon" />
          </button>

        </div>

        {/* VERSION SELECTOR */}
        <div
          onClick={() => setIsVersionModalOpen(true)}
          className="
  relative min-w-[90px] inline-block cursor-pointer
  transform-gpu transition-all duration-200 ease-out
  hover:scale-[1.06] active:scale-[0.96]
  hover:shadow-[0_0_12px_rgba(59,130,246,0.6)]
  dark:hover:shadow-[0_0_14px_rgba(59,130,246,0.7)]
  rounded-xl bg-gray-50 dark:bg-gray-800
  border border-gray-300 dark:border-[#2A2F35]
  px-3 py-2
"

        >
          <div className="flex items-center justify-between w-full">
          <span className="text-sm font-medium text-gray-900 dark:text-[#E5E5E5]">
              {englishVersion}
            </span>
            <i className="fas fa-caret-down text-xs text-gray-700 dark:text-[#9CA3AF]" />
          </div>
        </div>

      </div>

      {/* BOOK + CHAPTER MODAL */}
      {isModalOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[99999] bg-gray-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="
              relative z-[100000]
              bg-white dark:bg-gray-900
              rounded-xl shadow-2xl
              w-full max-w-2xl h-[80vh] flex flex-col
              border border-gray-200 dark:border-[#2A2F35]
              overflow-hidden
            "
            
              onClick={(e) => e.stopPropagation()}
            >

              <div className="
  p-4 border-b border-gray-200 dark:border-[#2A2F35]
  flex items-center justify-between 
  bg-gray-50 dark:bg-gray-900
"
>
                {selectionStep === "CHAPTER" ? (
                  <button
                    onClick={() => setSelectionStep("BOOK")}
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center font-medium"
                  >
                    <i className="fas fa-arrow-left mr-2" /> Books
                  </button>
                ) : (
                  <span className="text-lg font-bold text-gray-800 dark:text-[#E5E5E5]">
                    Select Book
                  </span>
                )}

                {selectionStep === "CHAPTER" && (
                  <span className="text-lg font-bold text-gray-800 dark:text-[#E5E5E5]">
                    {TELUGU_BOOK_NAMES[tempBook] || tempBook}
                  </span>
                )}

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-800 dark:text-[#9CA3AF] dark:hover:text-white p-2"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-4">
                {selectionStep === "BOOK" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {books.map((book) => (
                      <button
                        key={book}
                        onClick={() => handleBookSelect(book)}
                        className={`
                          p-3 rounded-lg transition-all text-center
                          ${tempBook === book
                            ? "bg-blue-600 text-white shadow-md"
                            : "bg-gray-100 text-gray-800 hover:bg-blue-100 hover:text-blue-700 dark:bg-gray-800 dark:text-[#E5E5E5] dark:hover:bg-[#2A2F35]"
                          }                          
                        `}
                      >
                        <div className="text-sm font-normal truncate">
                          {TELUGU_BOOK_NAMES[book]}
                        </div>
                        <div className="text-xs opacity-80 truncate">{book}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
                    {Array.from({ length: tempChapterCount }, (_, i) => i + 1).map(
                      (ch) => (
                        <button
                          key={ch}
                          onClick={() => handleChapterSelect(ch)}
                          className="
  aspect-square flex items-center justify-center
  text-base font-semibold rounded-lg
  bg-gray-100 dark:bg-gray-800
  hover:bg-blue-600 hover:text-white
  dark:text-[#E5E5E5] dark:hover:bg-blue-600
  transition-all border border-gray-200 dark:border-[#2A2F35]
"

                        >
                          {ch}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </ModalPortal>
      )}

      {/* VERSION MODAL */}
{isVersionModalOpen && (
  <ModalPortal>
    <div
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
      onClick={() => setIsVersionModalOpen(false)}
    >
      <div
        className="
          relative bg-white dark:bg-[#111418]
          rounded-xl shadow-2xl
          w-full max-w-sm max-h-[70vh] flex flex-col
          border border-gray-200 dark:border-[#2A2F35]
          overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-[#2A2F35] bg-gray-50 dark:bg-[#1A1D21] flex items-center justify-between">
          <span className="text-lg font-bold text-gray-800 dark:text-[#E5E5E5]">
            Select Version
          </span>

          <button
            onClick={() => setIsVersionModalOpen(false)}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white p-2"
          >
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3">
            {englishVersions.map((v) => (
              <button
                key={v}
                onClick={() => {
                  onEnglishVersionChange(v);
                  setIsVersionModalOpen(false);
                }}
                className={`
                  w-full p-3 rounded-lg transition-all text-left
                  ${
                    englishVersion === v
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-800 hover:bg-blue-100 hover:text-blue-700 dark:bg-[#1A1D21] dark:text-[#E5E5E5] dark:hover:bg-[#2A2F35]"
                  }
                `}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
)}


    </div>
  );
}
