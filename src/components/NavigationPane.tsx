import React, { useState } from "react";
import { BIBLE_META } from "../data/bibleMeta";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import ModalPortal from "./ModalPortal";

interface Props {
  selectedBook: string;
  selectedChapter: number;
  onBookChange: (b: string) => void;
  onChapterChange: (c: number) => void;
  onNextChapter: () => void;
  onPreviousChapter: () => void;
  isFirstChapterOfBible: boolean;
  isLastChapterOfBible: boolean;

  studyMode: "single" | "parallel";
  singleVersion: string;
  leftVersion: string;
  rightVersion: string;
  onSetStudyMode: (m: "single" | "parallel") => void;
  onSetSingleVersion: (v: string) => void;
  onSetLeftVersion: (v: string) => void;
  onSetRightVersion: (v: string) => void;

  versions: string[];
}

export default function NavigationPane(props: Props) {
  const {
    selectedBook,
    selectedChapter,
    onBookChange,
    onChapterChange,
    onNextChapter,
    onPreviousChapter,
    isFirstChapterOfBible,
    isLastChapterOfBible,

    studyMode,
    singleVersion,
    leftVersion,
    rightVersion,
    onSetStudyMode,
    onSetSingleVersion,
    onSetLeftVersion,
    onSetRightVersion,
    versions,
  } = props;

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isBookModal, setIsBookModal] = useState(false);
  const [selectionStep, setSelectionStep] = useState<"BOOK" | "CHAPTER">("BOOK");
  const [tempBook, setTempBook] = useState(selectedBook);

  const unifiedLabel = `${selectedBook} ${selectedChapter}`;

  const openBookModal = () => {
    setTempBook(selectedBook);
    setSelectionStep("BOOK");
    setIsBookModal(true);
  };
  

  const handleBookSelect = (book: string) => {
    setTempBook(book);
    setSelectionStep("CHAPTER");
  };
  

  const handleChapterSelect = (ch: number) => {
    onBookChange(tempBook);
    onChapterChange(ch);
    setIsBookModal(false);
  };
  

  // compute current chapter count for the selected book
  const currentBookMeta = BIBLE_META.find((b) => b.name === selectedBook);
  const currentChapterCount = currentBookMeta ? currentBookMeta.chapters : 0;

  return (
    <div className="p-3 bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-[#2A2F35] shadow-sm flex items-center gap-3">
      {/* UNIFIED BOOK+CHAPTER BUTTON */}
      <div
        className="
        group flex flex-1 items-center justify-between
        bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-[#2A2F35]
        rounded-xl px-3 py-2
        transform-gpu transition-all duration-150 ease-out
        hover:shadow-[0_0_6px_rgba(59,130,246,0.45)]
        dark:hover:shadow-[0_0_8px_rgba(59,130,246,0.5)]
      "
      
      >
        <button
          disabled={isFirstChapterOfBible}
          onClick={(e) => { e.stopPropagation(); onPreviousChapter(); }}
          className="text-gray-500 dark:text-gray-400 disabled:opacity-30 px-2"
          aria-label="Previous chapter"
        >
          <i className="fas fa-caret-left" />
        </button>

        <button
          onClick={openBookModal}
          className="flex-1 text-center text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
          title={unifiedLabel}
        >
          {unifiedLabel}
        </button>

        <button
          disabled={isLastChapterOfBible}
          onClick={(e) => { e.stopPropagation(); onNextChapter(); }}
          className="text-gray-500 dark:text-gray-400 disabled:opacity-30 px-2"
          aria-label="Next chapter"
        >
          <i className="fas fa-caret-right" />
        </button>
      </div>

      {/* VERSION PICKER ICON */}
      <button
        onClick={() => setIsPickerOpen(true)}
        className="
  w-10 h-10 flex items-center justify-center
  rounded-xl bg-gray-50 dark:bg-gray-800
  border border-gray-300 dark:border-[#2A2F35]
  hover:shadow-[0_0_6px_rgba(59,130,246,0.45)]
  dark:hover:shadow-[0_0_8px_rgba(59,130,246,0.5)]
  transition
"

        aria-label="Open version picker"
      >
        <i className="fas fa-sliders-h text-gray-700 dark:text-gray-300" />
      </button>

      {/* Book + Chapter Modal */}
      {isBookModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setIsBookModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-[92%] max-w-2xl max-h-[85vh] overflow-y-auto p-4 border border-gray-200 dark:border-[#2A2F35]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Select Book</h2>
                <button onClick={() => setIsBookModal(false)} className="p-2 text-gray-500">
                  <i className="fas fa-times" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-4">

{selectionStep === "BOOK" && (
  <>
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-4">
      {BIBLE_META.map((b) => (
        <button
          key={b.name}
          onClick={() => handleBookSelect(b.name)}
          className="p-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white"
        >
          <div className="text-sm truncate">{TELUGU_BOOK_NAMES[b.name]}</div>
          <div className="text-xs opacity-80 truncate">{b.name}</div>
        </button>
      ))}
    </div>
  </>
)}

{selectionStep === "CHAPTER" && (
  <>
    <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">
      Select Chapter
    </h3>
    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
      {Array.from({ length: BIBLE_META.find((b) => b.name === tempBook)?.chapters || 0 }, (_, i) => i + 1)
        .map((ch) => (
          <button
            key={ch}
            onClick={() => handleChapterSelect(ch)}
            className="p-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white"
          >
            {ch}
          </button>
        ))}
    </div>
  </>
)}

</div>

            </div>
          </div>
        </ModalPortal>
      )}

      {/* Version / Study Picker Modal */}
      {isPickerOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
            onClick={() => setIsPickerOpen(false)}
          >
            <div
              className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-xl shadow-xl p-4 border border-gray-200 dark:border-[#2A2F35]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Versions</h3>
                <button onClick={() => setIsPickerOpen(false)} className="p-2 text-gray-500">
                  <i className="fas fa-times" />
                </button>
              </div>

              {/* Mode toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => onSetStudyMode("single")}
                  className={`flex-1 py-2 rounded ${studyMode === "single" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
                >
                  Single
                </button>
                <button
                  onClick={() => onSetStudyMode("parallel")}
                  className={`flex-1 py-2 rounded ${studyMode === "parallel" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
                >
                  Parallel
                </button>
              </div>

              {/* Version pickers */}
              {studyMode === "single" ? (
                <select
                  value={singleVersion}
                  onChange={(e) => onSetSingleVersion(e.target.value)}
                  className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800"
                >
                  {versions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <>
                  <div className="mb-3">
                    <select
                      value={leftVersion}
                      onChange={(e) => onSetLeftVersion(e.target.value)}
                      className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800"
                    >
                      {versions.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <select
                      value={rightVersion}
                      onChange={(e) => onSetRightVersion(e.target.value)}
                      className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800"
                    >
                      {versions.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
