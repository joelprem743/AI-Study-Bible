// src/components/NavigationPane.tsx
import React, { useState } from "react";
import { BIBLE_META } from "../data/bibleMeta";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import ModalPortal from "./ModalPortal";
import { BIBLE_META_WITH_VERSE_COUNTS } from "../data/bibleMetaWithVerseCounts";

interface Props {
  selectedBook: string;
  selectedChapter: number;
  selectedVerse: number;

  onNavigateTo: (book: string, chapter: number, verse: number) => void;


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
  versions: readonly string[];
}

export default function NavigationPane(props: Props) {
  const {
    selectedBook,
    selectedChapter,
    selectedVerse,
    onNavigateTo,

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

  const isTeluguSingleMode =
  studyMode === "single" && singleVersion === "TELUGU_COMMUNITY_V1";

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isBookModal, setIsBookModal] = useState(false);
  const [selectionStep, setSelectionStep] =
  useState<"BOOK" | "CHAPTER" | "VERSE">("BOOK");

const [tempBook, setTempBook] = useState(selectedBook);
const [tempChapter, setTempChapter] = useState(selectedChapter);

  const OLD_TESTAMENT = [
    "Genesis","Exodus","Leviticus","Numbers","Deuteronomy",
    "Joshua","Judges","Ruth","1 Samuel","2 Samuel",
    "1 Kings","2 Kings","1 Chronicles","2 Chronicles",
    "Ezra","Nehemiah","Esther","Job","Psalms","Proverbs",
    "Ecclesiastes","Song of Solomon","Isaiah","Jeremiah",
    "Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos",
    "Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah",
    "Haggai","Zechariah","Malachi",
  ];

  const VERSION_LABELS: Record<string, string> = {
    TELUGU_COMMUNITY_V1: "తెలుగు బైబిల్",
    ESV: "English Standard Version",
    NIV: "New International Version",
    KJV: "King James Version",
    NKJV: "New King James Version",
    GNB: "Good News Bible",
    ARAMAIC_PLAIN_EN: "Aramaic Bible (Plain English only New Testament!)",
    NLT:"New Living Translation",
    NASB:"NASB 1995",
    // HEBREW_OT: "Hebrew Bible (Original)",
    // GREEK_NT: "Greek New Testament (Original)",
  };  

  const getVersionLabel = (v: string) => VERSION_LABELS[v] ?? v;

  // -------- Original language guards --------
const isOriginalVersion = (v?: string) =>
  v === "HEBREW_OT" || v === "GREEK_NT";

const isBookInOT = (book: string) =>
  BIBLE_META.findIndex(b => b.name === book) < 39;

const isValidOriginalForBook = (book: string, version?: string) => {
  if (!isOriginalVersion(version)) return true;

  const isOT = isBookInOT(book);
  return (
    (version === "HEBREW_OT" && isOT) ||
    (version === "GREEK_NT" && !isOT)
  );
};


  
  
  const NEW_TESTAMENT = [
    "Matthew","Mark","Luke","John","Acts","Romans",
    "1 Corinthians","2 Corinthians","Galatians","Ephesians",
    "Philippians","Colossians","1 Thessalonians","2 Thessalonians",
    "1 Timothy","2 Timothy","Titus","Philemon","Hebrews",
    "James","1 Peter","2 Peter","1 John","2 John","3 John",
    "Jude","Revelation",
  ];
  
  // ---------- Version / language helpers ----------


  const isTeluguVersion = (version?: string) =>
    version === "TELUGU_COMMUNITY_V1";
  
    
  const getBookNameByVersion = (book: string, version?: string) => {
    if (isTeluguVersion(version)) {
      return TELUGU_BOOK_NAMES[book] || book;
    }
    return book;
  };
  

const getBookLabelForPicker = (book: string) => {
  const telugu = TELUGU_BOOK_NAMES[book] || book;
  const english = book;

  if (studyMode === "single") {
    return isTeluguVersion(singleVersion) ? telugu : english;
  }

  // parallel
  const leftIsTelugu = isTeluguVersion(leftVersion);
  const rightIsTelugu = isTeluguVersion(rightVersion);

  if (leftIsTelugu === rightIsTelugu) {
    return leftIsTelugu ? telugu : english;
  }

  return `${english} / ${telugu}`;
};



const unifiedLabel =
  studyMode === "single"
    ? `${getBookNameByVersion(selectedBook, singleVersion)} ${selectedChapter}`
    : (() => {
        const left = getBookNameByVersion(selectedBook, leftVersion);
        const right = getBookNameByVersion(selectedBook, rightVersion);

        const bookPart = left === right ? left : `${left}–${right}`;
        return `${bookPart} ${selectedChapter}`;
      })();



    const openBookModal = () => {
      setTempBook(selectedBook);
      setTempChapter(selectedChapter);
      setSelectionStep("BOOK");
      setIsBookModal(true);
    };
    
  

  const handleBookSelect = (book: string) => {
    const activeVersion =
      studyMode === "single" ? singleVersion : leftVersion;
  
    if (!isValidOriginalForBook(book, activeVersion)) {
      alert("This book is not available in the selected original language.");
      return;
    }
  
    setTempBook(book);
    setSelectionStep("CHAPTER");
  };
  
  const handleChapterSelect = (ch: number) => {
    setTempChapter(ch);
    setSelectionStep("VERSE");
  };
  
  
  
  const handleVerseSelect = (v: number) => {
    onNavigateTo(tempBook, tempChapter, v);
    setIsBookModal(false);
  };
  
  
  

  // compute current chapter count for the selected book
  const currentBookMeta = BIBLE_META.find((b) => b.name === selectedBook);
  const currentChapterCount = currentBookMeta ? currentBookMeta.chapters : 0;


  const getVerseCount = (book: string, chapter: number) => {
    const meta = BIBLE_META_WITH_VERSE_COUNTS.find((b) => b.name === book);
    if (!meta) return 0;
  
    return meta.chapters[chapter - 1] ?? 0;
  };
  const currentVerseCount = getVerseCount(tempBook, tempChapter);
  
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
  className="flex-1 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 truncate"
  title={unifiedLabel}
>
<span
  className={`
    font-semibold tracking-tight
    ${
      studyMode === "single"
        ? isTeluguVersion(singleVersion)
          ? "font-telugu"
          : ""
        : isTeluguVersion(leftVersion) && isTeluguVersion(rightVersion)
        ? "font-telugu"
        : ""
    }
  `}
>
  {unifiedLabel}
</span>


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
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
  {isTeluguSingleMode ? "గ్రంథము ఎంచుకోండి" : "Select Book"}
</h2>

                <button onClick={() => setIsBookModal(false)} className="p-2 text-gray-500">
                  <i className="fas fa-times" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-4">

              {selectionStep === "BOOK" && (
  <>
    {/* OLD TESTAMENT */}
    <h3 className="mb-2 text-sm font-bold uppercase text-gray-500 dark:text-gray-400">
  {isTeluguSingleMode ? "పాత నిబంధన" : "Old Testament"}
</h3>

    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6">
      {BIBLE_META.filter(b => OLD_TESTAMENT.includes(b.name)).map((b) => (
        <button
          key={b.name}
          onClick={() => handleBookSelect(b.name)}
          className="p-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white"
        >
          {studyMode === "single" ? (
            <div
              className={`text-sm truncate font-semibold ${
                isTeluguVersion(singleVersion) ? "font-telugu" : ""
              }`}
            >
              {getBookLabelForPicker(b.name)}
            </div>
          ) : (
            <>
              <div className="text-sm truncate">
                {TELUGU_BOOK_NAMES[b.name]}
              </div>
              <div className="text-xs opacity-80 truncate">
                {b.name}
              </div>
            </>
          )}
        </button>
      ))}
    </div>

    {/* NEW TESTAMENT */}
    <h3 className="mb-2 text-sm font-bold uppercase text-gray-500 dark:text-gray-400">
  {isTeluguSingleMode ? "కొత్త నిబంధన" : "New Testament"}
</h3>


    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {BIBLE_META.filter(b => NEW_TESTAMENT.includes(b.name)).map((b) => (
        <button
          key={b.name}
          onClick={() => handleBookSelect(b.name)}
          className="p-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white"
        >
          {studyMode === "single" ? (
            <div
              className={`text-sm truncate font-semibold ${
                isTeluguVersion(singleVersion) ? "font-telugu" : ""
              }`}
            >
              {getBookLabelForPicker(b.name)}
            </div>
          ) : (
            <>
              <div className="text-sm truncate">
                {TELUGU_BOOK_NAMES[b.name]}
              </div>
              <div className="text-xs opacity-80 truncate">
                {b.name}
              </div>
            </>
          )}
        </button>
      ))}
    </div>
  </>
)}


{selectionStep === "CHAPTER" && (
  <>
    <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">
      {isTeluguSingleMode ? "అధ్యాయం ఎంచుకోండి" : "Select Chapter"}
    </h3>

    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
      {Array.from(
        { length: BIBLE_META.find((b) => b.name === tempBook)?.chapters || 0 },
        (_, i) => i + 1
      ).map((ch) => (
        <button
          key={ch}
          onClick={() => handleChapterSelect(ch)}
          className="p-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white"
        >
          {ch}
        </button>
      ))}
    </div>

    {/* ✅ Back + Close buttons */}
    <div className="mt-4 flex justify-between">
      <button
        onClick={() => setSelectionStep("BOOK")}
        className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
      >
        {isTeluguSingleMode ? "వెనక్కి" : "Back"}
      </button>

      <button
        onClick={() => setIsBookModal(false)}
        className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
      >
        {isTeluguSingleMode ? "మూసివేయి" : "Close"}
      </button>
    </div>
  </>
)}


{selectionStep === "VERSE" && (
  <>
    <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">
      {isTeluguSingleMode ? "వచనం ఎంచుకోండి" : "Select Verse"}
    </h3>

    <div className="max-h-[50vh] overflow-y-auto">
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
        {Array.from({ length: currentVerseCount }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            onClick={() => handleVerseSelect(v)}
            className="p-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white"
          >
            {v}
          </button>
        ))}
      </div>
    </div>

    <div className="mt-4 flex justify-between">
      <button
        onClick={() => setSelectionStep("CHAPTER")}
        className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
      >
        {isTeluguSingleMode ? "వెనక్కి" : "Back"}
      </button>

      <button
        onClick={() => setIsBookModal(false)}
        className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
      >
        {isTeluguSingleMode ? "మూసివేయి" : "Close"}
      </button>
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
                  className={`flex-1 py-2 rounded ${  studyMode === "single" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
                >
                  Single
                </button>
                <button
  onClick={() => {
    onSetStudyMode("parallel");

    // FORCE sane defaults
    onSetLeftVersion("ESV");
    onSetRightVersion("TELUGU_COMMUNITY_V1");
  }}
  className={`flex-1 py-2 rounded ${
    studyMode === "parallel"
      ? "bg-blue-600 text-white"
      : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
  }`}
>
  Parallel
</button>

              </div>

              {/* Version pickers */}
              {studyMode === "single" ? (
                <select
                value={singleVersion}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!isValidOriginalForBook(selectedBook, v)) {
                    alert("This original language is not available for this book.");
                    return;
                  }
                  onSetSingleVersion(v);
setIsPickerOpen(false); // ⬅️ critical for mobile

                }}
                className="w-full min-w-[260px] p-2 rounded bg-gray-100 dark:bg-gray-800 text-sm"
              >
              
              
              {versions.map((v) => (
  <option key={v} value={v}>
    {getVersionLabel(v)}
  </option>
))}

                </select>
              ) : (
                <>
                  <div className="mb-3">
                    <select
                      value={leftVersion}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!isValidOriginalForBook(selectedBook, v)) {
                          alert("This original language is not available for this book.");
                          return;
                        }
                        onSetLeftVersion(v);
                      }}
                      
                      className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800"
                    >
                      {versions.map((v) => (
  <option key={v} value={v}>
    {getVersionLabel(v)}
  </option>
))}

                    </select>
                  </div>
                  <div>
                    <select
                      value={rightVersion}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!isValidOriginalForBook(selectedBook, v)) {
                          alert("This original language is not available for this book.");
                          return;
                        }
                        onSetRightVersion(v);
                      }}                      
                      className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800"
                    >
                      {versions.map((v) => (
  <option key={v} value={v}>
    {getVersionLabel(v)}
  </option>
))}

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
