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


  // const isTeluguSingleMode =
  // studyMode === "single" && singleVersion === "TELUGU_COMMUNITY_V1";

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isBookModal, setIsBookModal] = useState(false);
  const [selectionStep, setSelectionStep] =
    useState<"BOOK" | "CHAPTER" | "VERSE">("BOOK");

  const [tempBook, setTempBook] = useState(selectedBook);
  const [tempChapter, setTempChapter] = useState(selectedChapter);

  const OLD_TESTAMENT = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
    "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah",
    "Haggai", "Zechariah", "Malachi",
  ];

  const VERSION_LABELS: Record<string, string> = {
    TELUGU_COMMUNITY_V1: "తెలుగు బైబిల్",
    ESV: "English Standard Version",
    NIV: "New International Version",
    KJV: "King James Version",
    NKJV: "New King James Version",
    GNB: "Good News Bible",
    ARAMAIC_PLAIN_EN: "Aramaic Bible (Plain English only New Testament!)",
    NLT: "New Living Translation",
    NASB: "NASB 1995",
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
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
    "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
    "Jude", "Revelation",
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

  const isTrueParallel =
    studyMode === "parallel" &&
    leftVersion !== rightVersion &&
    isTeluguVersion(leftVersion) !== isTeluguVersion(rightVersion);

  const getBookLabelForPicker = (book: string) => {
    const telugu = TELUGU_BOOK_NAMES[book] || book;
    const english = book;

    // ✅ SINGLE MODE → language of selected version only
    if (studyMode === "single") {
      return isTeluguVersion(singleVersion) ? telugu : english;
    }

    // ✅ PARALLEL MODE
    if (!isTrueParallel) {
      // same language on both sides
      return isTeluguVersion(leftVersion) ? telugu : english;
    }

    // ✅ TRUE parallel (different languages)
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

  const getBookLabelClass = (book: string) => {
    const isTelugu =
      studyMode === "single"
        ? isTeluguVersion(singleVersion)
        : isTeluguVersion(leftVersion);

    return isTelugu
      ? "font-telugu w-full min-w-0 text-[13px] sm:text-[14px] font-normal truncate leading-tight tracking-[0.15px] text-center"
      : "w-full min-w-0 text-[14px] sm:text-[15px] font-medium truncate leading-tight text-center";
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
    <div
      className="
    flex items-center gap-3 sticky top-14 z-30
    px-3 md:px-4 py-2
    bg-slate-50 dark:bg-slate-900
    border-b border-slate-200 dark:border-slate-700
  "
    >

      {/* <div
        className="
          flex items-center gap-3
          rounded-2xl
          bg-white/80 dark:bg-white/5
          border border-slate-200/60 dark:border-white/10
          shadow-sm
          px-3 py-2
        "
      > */}


      {/* UNIFIED BOOK+CHAPTER BUTTON */}
      <div
        id="tour-book-selector"
        className={`
    group flex-1 min-w-0 flex items-center rounded-full
    border ring-1 ring-inset
    h-10 px-2 overflow-hidden
    transition-all duration-150

    ${isBookModal
            ? `
          bg-gradient-to-b
          from-slate-400 via-slate-300 to-slate-400
          dark:from-slate-700 dark:via-slate-600 dark:to-slate-700

          border-slate-400 dark:border-slate-500

          ring-slate-300/60 dark:ring-slate-400/20

          shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]
        `
            : `
          bg-gradient-to-b
          from-slate-300 via-slate-200 to-slate-300
          dark:from-slate-800 dark:via-slate-700 dark:to-slate-800

          border-slate-200 dark:border-slate-600

          ring-white/40 dark:ring-white/5

          shadow-[0_2px_4px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.06)]

          hover:from-slate-350 hover:to-slate-250
          dark:hover:from-slate-700 dark:hover:to-slate-600
        `
          }
  `}
      >

        <button
          disabled={isFirstChapterOfBible}
          onClick={(e) => { e.stopPropagation(); onPreviousChapter(); }}
          className="
  w-9 h-9 flex items-center justify-center
  rounded-xl
text-slate-500 dark:text-slate-400
hover:bg-slate-100 dark:hover:bg-slate-700
hover:text-slate-900 dark:hover:text-white
  transition-all duration-150
  disabled:opacity-30 disabled:hover:bg-transparent
"

          aria-label="Previous chapter"
        >
          <i className="fas fa-caret-left" />
        </button>

        <button
          onClick={openBookModal}
          title={unifiedLabel}
          className="
    flex-1 min-w-0
    h-10
    px-1
    flex items-center justify-center
    overflow-hidden
    text-gray-900 dark:text-gray-100
  "
        >
          <span
            className={`
    block w-full min-w-0
    overflow-hidden text-ellipsis whitespace-nowrap
    font-semibold
    ${(studyMode === "single" && isTeluguVersion(singleVersion)) ||
                (studyMode === "parallel" &&
                  (isTeluguVersion(leftVersion) || isTeluguVersion(rightVersion)))

                ? "!font-telugu !text-[13px] sm:!text-[14px] !tracking-[0.2px]"
                : "!text-[15px] sm:!text-[16px]"
              }
  `}
          >
            {unifiedLabel}
          </span>


        </button>




        <button
          disabled={isLastChapterOfBible}
          onClick={(e) => { e.stopPropagation(); onNextChapter(); }}
          className="
  w-9 h-9 flex items-center justify-center
  rounded-xl
text-slate-500 dark:text-slate-400
hover:bg-slate-100 dark:hover:bg-slate-700
hover:text-slate-900 dark:hover:text-white
  transition-all duration-150
  disabled:opacity-30 disabled:hover:bg-transparent
"

          aria-label="Next chapter"
        >
          <i className="fas fa-caret-right" />
        </button>
      </div>

      {/* VERSION PICKER ICON */}
      <button
        id="tour-version-picker"
        onClick={() => setIsPickerOpen(true)}
        className="
    shrink-0
    w-10 h-10 flex items-center justify-center
    rounded-xl

    bg-gradient-to-b
    from-slate-300 via-slate-200 to-slate-300
    dark:from-slate-800 dark:via-slate-700 dark:to-slate-800

    border border-slate-300 dark:border-slate-600

    ring-1 ring-inset ring-white/40 dark:ring-white/5

    shadow-[0_2px_4px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.06)]

    text-slate-700 dark:text-slate-200

    hover:from-slate-350 hover:to-slate-250
    dark:hover:from-slate-700 dark:hover:to-slate-600

    transition-all duration-150
  "
        aria-label="Open version picker"
      >
        <i className="fas fa-sliders-h text-slate-700 dark:text-white/80" />
      </button>


      {/* Book + Chapter Modal */}
      {isBookModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setIsBookModal(false)}
          >
            <div
              className="
    rounded-2xl
    w-[92%] max-w-2xl
    max-h-[85vh]
    flex flex-col
    overflow-hidden

    bg-gradient-to-b
    from-white via-slate-50 to-slate-100
    dark:from-slate-900 dark:via-slate-800 dark:to-slate-900

    border border-slate-200 dark:border-slate-700

    ring-1 ring-inset ring-white/50 dark:ring-white/5

    shadow-[0_20px_50px_rgba(0,0,0,0.35),0_8px_20px_rgba(0,0,0,0.20)]
  "
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="
    flex-shrink-0 px-4 py-3

    bg-gradient-to-b
    from-slate-200 via-slate-100 to-white
    dark:from-slate-800 dark:via-slate-900 dark:to-slate-900

    border-b border-slate-300/70 dark:border-slate-700

    shadow-[inset_0_-1px_0_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.08)]

    z-10
  "
              >

                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                      {selectionStep === "BOOK" && (isTeluguVersion(singleVersion) ? "గ్రంథము ఎంచుకోండి" : "Select Book")}
                      {selectionStep === "CHAPTER" && (isTeluguVersion(singleVersion) ? "అధ్యాయం ఎంచుకోండి" : "Select Chapter")}
                      {selectionStep === "VERSE" && (isTeluguVersion(singleVersion) ? "వచనం ఎంచుకోండి" : "Select Verse")}
                    </h2>

                    {(selectionStep === "CHAPTER" || selectionStep === "VERSE") && (
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 mt-0.5 truncate">
                        {getBookLabelForPicker(tempBook)}
                        {selectionStep === "VERSE" ? ` • ${tempChapter}` : ""}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setIsBookModal(false)}
                    className="
        w-9 h-9 flex items-center justify-center
        rounded-xl
        text-slate-500 dark:text-white/70
        hover:bg-slate-100 dark:hover:bg-white/10
        transition
      "
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              </div>

              <div className="
  flex-grow overflow-y-auto px-4 py-4
  bg-transparent
">




                {selectionStep === "BOOK" && (
                  <>
                    {/* OLD TESTAMENT */}
                    <h3 className="mt-1 mb-3 text-xs font-semibold tracking-wide uppercase text-gray-500 dark:text-gray-400">

                      {isTeluguVersion(singleVersion) ? "పాత నిబంధన" : "Old Testament"}
                    </h3>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6">
                      {BIBLE_META.filter(b => OLD_TESTAMENT.includes(b.name)).map((b) => (
                        <button
                          key={b.name}
                          onClick={() => handleBookSelect(b.name)}
                          className="
          p-2 rounded-xl
        
          bg-gradient-to-b
          from-white to-slate-100
          dark:from-slate-800 dark:to-slate-700
        
          text-slate-900 dark:text-white/90
        
          border border-slate-200 dark:border-slate-600
        
          ring-1 ring-inset ring-white/40 dark:ring-white/5
        
          shadow-[0_1px_2px_rgba(0,0,0,0.12)]
        
          hover:shadow-[0_4px_8px_rgba(0,0,0,0.18)]
          hover:-translate-y-[1px]
        
          active:translate-y-[1px]
          active:shadow-[0_1px_2px_rgba(0,0,0,0.20)]
        
          transition-all duration-150
        "

                        >
                          {isTrueParallel ? (
                            <>
                              <div className="font-telugu text-[13px] sm:text-[14px] font-medium truncate leading-tight">
                                {TELUGU_BOOK_NAMES[b.name]}
                              </div>
                              <div className="text-[12px] sm:text-[13px] font-semibold text-slate-600 dark:text-slate-300 truncate leading-tight">
                                {b.name}
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center leading-tight w-full min-w-0">
                              <div className={getBookLabelClass(b.name)}>
                                {getBookLabelForPicker(b.name)}
                              </div>

                              {/* {isTeluguVersion(singleVersion) && (
      <div className="text-[11px] sm:text-[12px] text-slate-500 dark:text-white/50 truncate leading-tight">
        {b.name}
      </div>
    )} */}
                            </div>
                          )}



                        </button>
                      ))}
                    </div>

                    {/* NEW TESTAMENT */}
                    <h3 className="mt-1 mb-3 text-xs font-semibold tracking-wide uppercase text-gray-500 dark:text-gray-400">

                      {isTeluguVersion(singleVersion) ? "కొత్త నిబంధన" : "New Testament"}
                    </h3>


                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {BIBLE_META.filter(b => NEW_TESTAMENT.includes(b.name)).map((b) => (
                        <button
                          key={b.name}
                          onClick={() => handleBookSelect(b.name)}
                          className="
          p-2 rounded-xl
        
          bg-gradient-to-b
          from-white to-slate-100
          dark:from-slate-800 dark:to-slate-700
        
          text-slate-900 dark:text-white/90
        
          border border-slate-200 dark:border-slate-600
        
          ring-1 ring-inset ring-white/40 dark:ring-white/5
        
          shadow-[0_1px_2px_rgba(0,0,0,0.12)]
        
          hover:shadow-[0_4px_8px_rgba(0,0,0,0.18)]
          hover:-translate-y-[1px]
        
          active:translate-y-[1px]
          active:shadow-[0_1px_2px_rgba(0,0,0,0.20)]
        
          transition-all duration-150
        "

                        >
                          {isTrueParallel ? (
                            <>
                              <div className="font-telugu text-[13px] sm:text-[14px] font-semibold truncate leading-tight tracking-[0.2px]">
                                {TELUGU_BOOK_NAMES[b.name]}
                              </div>
                              <div className="text-[11px] sm:text-[12px] opacity-80 truncate leading-tight">
                                {b.name}
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center leading-tight w-full min-w-0">
                              <div className={getBookLabelClass(b.name)}>
                                {getBookLabelForPicker(b.name)}
                              </div>

                              {/* {studyMode === "single" && isTeluguVersion(singleVersion) && (
  <div className="text-[11px] sm:text-[12px] text-slate-500 dark:text-white/50 truncate leading-tight text-center">
    {b.name}
  </div>
)} */}

                            </div>
                          )}


                        </button>
                      ))}
                    </div>
                  </>
                )}


                {selectionStep === "CHAPTER" && (
                  <>


                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                      {Array.from(
                        { length: BIBLE_META.find((b) => b.name === tempBook)?.chapters || 0 },
                        (_, i) => i + 1
                      ).map((ch) => (
                        <button
                          key={ch}
                          onClick={() => handleChapterSelect(ch)}
                          className="
          h-10 min-w-[42px] px-2
          flex items-center justify-center
        
          rounded-xl
        
          bg-gradient-to-b
          from-white to-slate-100
          dark:from-slate-800 dark:to-slate-700
        
          text-slate-900 dark:text-white/90
        
          border border-slate-200 dark:border-slate-600
        
          ring-1 ring-inset ring-white/40 dark:ring-white/5
        
          shadow-[0_1px_2px_rgba(0,0,0,0.12)]
        
          hover:shadow-[0_4px_8px_rgba(0,0,0,0.18)]
          hover:-translate-y-[1px]
        
          active:translate-y-[1px]
        
          transition-all duration-150
        "
                        >
                          <span className="block w-full text-center">
                            {ch}
                          </span>

                        </button>
                      ))}
                    </div>

                    {/* ✅ Back + Close buttons */}
                    <div className="mt-5 flex justify-between items-center">

                      {/* BACK BUTTON */}
                      <button
                        onClick={() => setSelectionStep("BOOK")}
                        className="
      px-4 py-2

      rounded-xl

      bg-gradient-to-b
      from-white to-slate-100
      dark:from-slate-800 dark:to-slate-700

      border border-slate-200 dark:border-slate-600

      ring-1 ring-inset ring-white/40 dark:ring-white/5

      text-sm font-medium
      text-slate-700 dark:text-slate-300

      shadow-sm

      hover:from-slate-100 hover:to-slate-200
      dark:hover:from-slate-700 dark:hover:to-slate-600

      hover:text-slate-900 dark:hover:text-white

      active:translate-y-[1px]

      transition-all duration-150
    "
                      >
                        {isTeluguVersion(singleVersion) ? "వెనక్కి" : "Back"}
                      </button>


                      {/* CLOSE BUTTON */}
                      <button
                        onClick={() => setIsBookModal(false)}
                        className="
      px-5 py-2

      rounded-xl

      bg-gradient-to-b
      from-slate-700 to-slate-800
      dark:from-slate-600 dark:to-slate-700

      border border-slate-600 dark:border-slate-500

      text-sm font-medium text-white

      shadow-md

      hover:from-slate-600 hover:to-slate-700

      active:translate-y-[1px]

      transition-all duration-150
    "
                      >
                        {isTeluguVersion(singleVersion) ? "మూసివేయి" : "Close"}
                      </button>

                    </div>

                  </>
                )}


                {selectionStep === "VERSE" && (
                  <>


                    <div className="max-h-[50vh] overflow-y-auto">
                      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                        {Array.from({ length: currentVerseCount }, (_, i) => i + 1).map((v) => (
                          <button
                            key={v}
                            onClick={() => handleVerseSelect(v)}
                            className="
  h-10 min-w-[42px] px-2
  flex items-center justify-center

  rounded-xl

  bg-gradient-to-b
  from-white to-slate-100
  dark:from-slate-800 dark:to-slate-700

  text-slate-900 dark:text-white/90

  border border-slate-200 dark:border-slate-600

  ring-1 ring-inset ring-white/40 dark:ring-white/5

  shadow-[0_1px_2px_rgba(0,0,0,0.12)]

  hover:shadow-[0_4px_8px_rgba(0,0,0,0.18)]
  hover:-translate-y-[1px]

  active:translate-y-[1px]

  transition-all duration-150
"
                          >
                            <span className="block w-full text-center">
                              {v}
                            </span>
                          </button>

                        ))}
                      </div>
                    </div>

                    <div className="mt-5 flex justify-between items-center">

                      {/* BACK BUTTON */}
                      <button
                        onClick={() => setSelectionStep("CHAPTER")}
                        className="
    px-4 py-2

    rounded-xl

    bg-gradient-to-b
    from-white to-slate-100
    dark:from-slate-800 dark:to-slate-700

    border border-slate-200 dark:border-slate-600

    ring-1 ring-inset ring-white/40 dark:ring-white/5

    text-sm font-medium
    text-slate-700 dark:text-slate-300

    shadow-sm

    hover:from-slate-100 hover:to-slate-200
    dark:hover:from-slate-700 dark:hover:to-slate-600

    hover:text-slate-900 dark:hover:text-white

    active:translate-y-[1px]

    transition-all duration-150
  "
                      >
                        {isTeluguVersion(singleVersion) ? "వెనక్కి" : "Back"}
                      </button>


                      {/* CLOSE BUTTON */}
                      <button
                        onClick={() => setIsBookModal(false)}
                        className="
    px-5 py-2

    rounded-xl

    bg-gradient-to-b
    from-slate-700 to-slate-800
    dark:from-slate-600 dark:to-slate-700

    border border-slate-600 dark:border-slate-500

    text-sm font-medium text-white

    shadow-md

    hover:from-slate-600 hover:to-slate-700

    active:translate-y-[1px]

    transition-all duration-150
  "
                      >
                        {isTeluguVersion(singleVersion) ? "మూసివేయి" : "Close"}
                      </button>

                    </div>

                  </>
                )}

              </div>

            </div>
          </div>
        </ModalPortal>
      )}




      {/* Version / Study Picker Modal sakbFAB */}
      {isPickerOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
            onClick={() => setIsPickerOpen(false)}
          >
            <div
              className="
    w-[92%] max-w-2xl max-h-[85vh]
    flex flex-col overflow-hidden

    rounded-2xl

    bg-gradient-to-b
    from-white via-slate-50 to-slate-100
    dark:from-slate-900 dark:via-slate-800 dark:to-slate-900

    border border-slate-200 dark:border-slate-700

    ring-1 ring-inset ring-white/40 dark:ring-white/5

    shadow-[0_25px_50px_rgba(0,0,0,0.35),0_10px_20px_rgba(0,0,0,0.25)]
  "
              onClick={(e) => e.stopPropagation()}
            >

              {/* Header */}
              <div
                className="
    flex-shrink-0 px-4 py-3
    bg-gradient-to-b
    from-slate-200 via-slate-100 to-white
    dark:from-slate-800 dark:via-slate-900 dark:to-slate-900
    border-b border-slate-300/70 dark:border-slate-700
    shadow-[inset_0_-1px_0_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.08)]
  "
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Versions
                  </h3>

                  <button
                    onClick={() => setIsPickerOpen(false)}
                    className="
        w-9 h-9 flex items-center justify-center
        rounded-xl
        text-slate-500 dark:text-white/70
        hover:bg-slate-100 dark:hover:bg-white/10
        transition
      "
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              </div>


              {/* BODY */}
              <div className="flex flex-col gap-4 px-4 py-4">

                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onSetStudyMode("single")}
                    className={`
        flex-1 py-2 rounded-xl font-medium transition-all duration-150
        ${studyMode === "single"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }
      `}
                  >
                    Single
                  </button>

                  <button
                    onClick={() => {
                      onSetStudyMode("parallel");
                      onSetLeftVersion("ESV");
                      onSetRightVersion("TELUGU_COMMUNITY_V1");
                    }}
                    className={`
        flex-1 py-2 rounded-xl font-medium transition-all duration-150
        ${studyMode === "parallel"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }
      `}
                  >
                    Parallel
                  </button>
                </div>


                {/* Version selectors */}
                {studyMode === "single" ? (

                  <div className="relative">

                    <select
                      value={singleVersion}
                      onChange={(e) => {
                        const v = e.target.value;

                        if (!isValidOriginalForBook(selectedBook, v)) {
                          alert("This original language is not available for this book.");
                          return;
                        }

                        onSetSingleVersion(v);
                        setIsPickerOpen(false);
                      }}
                      className="
    w-full px-3 py-2 pr-9 rounded-xl

    appearance-none

    bg-gradient-to-b
    from-white to-slate-100
    dark:from-slate-800 dark:to-slate-700

    border border-slate-300 dark:border-slate-600

    text-slate-900 dark:text-white

    shadow-sm

    focus:outline-none focus:ring-2 focus:ring-blue-500/40
  "
                    >
                      {versions.map((v) => (
                        <option key={v} value={v}>
                          {getVersionLabel(v)}
                        </option>
                      ))}
                    </select>

                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="
    w-0 h-0
    border-l-[4px] border-l-transparent
    border-r-[4px] border-r-transparent
    border-t-[5px]
    border-t-slate-500 dark:border-t-slate-400
    opacity-70
  " />
                    </div>


                  </div>


                ) : (

                  <div className="flex flex-col gap-3">

                    {/* LEFT VERSION */}
                    <div className="relative">

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
                        className="
      w-full px-3 py-2 pr-9 rounded-xl

      appearance-none

      bg-gradient-to-b
      from-white to-slate-100
      dark:from-slate-800 dark:to-slate-700

      border border-slate-300 dark:border-slate-600

      text-slate-900 dark:text-white

      shadow-sm

      focus:outline-none focus:ring-2 focus:ring-blue-500/40
    "
                      >
                        {versions.map((v) => (
                          <option key={v} value={v}>
                            {getVersionLabel(v)}
                          </option>
                        ))}
                      </select>

                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="
      w-0 h-0
      border-l-[4px] border-l-transparent
      border-r-[4px] border-r-transparent
      border-t-[5px]
      border-t-slate-500 dark:border-t-slate-400
      opacity-70
    " />
                      </div>

                    </div>


                    {/* RIGHT VERSION */}
                    <div className="relative">

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
                        className="
      w-full px-3 py-2 pr-9 rounded-xl

      appearance-none

      bg-gradient-to-b
      from-white to-slate-100
      dark:from-slate-800 dark:to-slate-700

      border border-slate-300 dark:border-slate-600

      text-slate-900 dark:text-white

      shadow-sm

      focus:outline-none focus:ring-2 focus:ring-blue-500/40
    "
                      >
                        {versions.map((v) => (
                          <option key={v} value={v}>
                            {getVersionLabel(v)}
                          </option>
                        ))}
                      </select>

                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="
      w-0 h-0
      border-l-[4px] border-l-transparent
      border-r-[4px] border-r-transparent
      border-t-[5px]
      border-t-slate-500 dark:border-t-slate-400
      opacity-70
    " />
                      </div>

                    </div>

                  </div>


                )}

              </div>


            </div>
          </div>
        </ModalPortal>
      )}
    </div>
    // </div>

  );
}
