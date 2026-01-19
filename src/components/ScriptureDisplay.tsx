// src/components/ScriptureDisplay.tsx
import React, { useEffect, useRef, useCallback, useState } from "react";
import { Verse, VerseReference } from "..";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";

const TELUGU_VERSION_KEY = "TELUGU_COMMUNITY_V1";

interface ScriptureDisplayProps {
  bookName: string;
  chapterNum: number;
  verses: Verse[];
  isLoading: boolean;
  error: string | null;

  englishVersion: string;
  studyMode: "single" | "parallel";
  leftVersion?: string;
  rightVersion?: string;

  onVerseSelect: (verseNum: number) => void;
  selectedVerseRef: VerseReference | null;

  onNextChapter: () => void;
  onPreviousChapter: () => void;

  onScrollDirectionChange?: (direction: "up" | "down") => void;
  highlights: { [verse: number]: string };
}

const VerseSkeleton: React.FC = () => (
  <div className="p-3 rounded-lg animate-pulse">
    <div className="space-y-2">
      <div className="h-4 bg-gray-300 dark:bg-[#1A1D21] rounded w-32" />
      <div className="h-4 bg-gray-300 dark:bg-[#1A1D21] rounded w-full" />
      <div className="h-4 bg-gray-300 dark:bg-[#1A1D21] rounded w-3/4" />
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
  studyMode,
  leftVersion,
  rightVersion,

  onVerseSelect,
  selectedVerseRef,

  onNextChapter,
  onPreviousChapter,
  onScrollDirectionChange,

  highlights,
}) => {


  const getHighlightClass = (c: string | undefined) => {
    switch (c) {
      case "yellow":
        return "bg-yellow-200/50 dark:bg-yellow-500/20";
      case "green":
        return "bg-green-200/50 dark:bg-green-500/20";
      case "pink":
        return "bg-rose-200/50 dark:bg-rose-500/20";
      case "blue":
        return "bg-sky-200/50 dark:bg-sky-500/20";
      default:
        return "";
    }
  };

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);
  const buttonsRef = useRef<HTMLDivElement | null>(null);

  const [autoScrollDir, setAutoScrollDir] = useState<"up" | "down" | null>(null);
  


  // Auto-scroll to selected verse


  useEffect(() => {
    if (
      !selectedVerseRef ||
      selectedVerseRef.book !== bookName ||
      selectedVerseRef.chapter !== chapterNum
    )
      return;

    const el = document.getElementById(`verse-${selectedVerseRef.verse}`);
    if (!el) return;

    setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }, [selectedVerseRef, bookName, chapterNum, verses]);

  // useEffect(() => {
  //   const version =
  //     studyMode === "single" ? englishVersion : leftVersion;

  //   if (!isOriginalVersion(version)) {
  //     setOriginalVerses({});
  //     return;
  //   }

  //   const loadOriginal = async () => {
  //     try {
  //       const table =
  //         version === "HEBREW_OT"
  //           ? "interlinear_words"
  //           : "nt_interlinear_with_strong";

  //       const res = await fetch(
  //         `/api/original?book=${encodeURIComponent(bookName)}&chapter=${chapterNum}&table=${table}`
  //       );
  //       const json = await res.json();

  //       const map: Record<number, string> = {};

  //       json.data.forEach((row: any) => {
  //         map[row.verse] = (map[row.verse] ?? "") + row.surface + " ";
  //       });

  //       setOriginalVerses(map);
  //     } catch (e) {
  //       console.error("Failed to load original text", e);
  //       setOriginalVerses({});
  //     }
  //   };

  //   loadOriginal();
  // }, [bookName, chapterNum, englishVersion, leftVersion, studyMode]);


  // Scroll detection → hide/show NavPane
  // ---------- Version / language helpers ----------
  const isTeluguVersion = (version?: string) =>
    version === TELUGU_VERSION_KEY;
  

  const getBookNameByVersion = (version?: string) => {
  if (isTeluguVersion(version)) {
    return TELUGU_BOOK_NAMES[bookName] || bookName;
  }
  return bookName;
};
  const getParallelBookHeading = () => {
    const left = getBookNameByVersion(leftVersion);
    const right = getBookNameByVersion(rightVersion);

    return left === right ? left : `${left}–${right}`;
};


  const lastScroll = useRef(0);
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!onScrollDirectionChange) return;

      const top = e.currentTarget.scrollTop;
      const diff = top - lastScroll.current;

      if (Math.abs(diff) < 40) return;

      if (diff > 0) onScrollDirectionChange("down");
      else onScrollDirectionChange("up");

      lastScroll.current = top;
    },
    [onScrollDirectionChange]
  );

  // const startAutoScroll = (direction: "up" | "down") => {
  //   stopAutoScroll(); // prevent multiple intervals
  
  //   const step = direction === "down" ? 8 : -8; // ✅ slow smooth speed
  
  //   scrollTimerRef.current = window.setInterval(() => {
  //     if (!scrollRef.current) return;
  
  //     scrollRef.current.scrollBy({
  //       top: step,
  //       behavior: "auto", // ✅ interval-based smoothness (better than smooth spam)
  //     });
  //   }, 16); // ~60fps
  // };
  
  const stopAutoScroll = () => {
    if (scrollTimerRef.current) {
      window.clearInterval(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
  
    isAutoScrollingRef.current = false; // ✅ important
    setAutoScrollDir(null);
  };
  
  

  const toggleAutoScroll = (direction: "up" | "down") => {
    // tap again = stop
    if (autoScrollDir === direction) {
      stopAutoScroll();
      return;
    }
  
    // switch direction
    stopAutoScroll();
    setAutoScrollDir(direction);
    
  
    const step = direction === "down" ? 1 : -1; // ✅ super slow
    const intervalMs = 60; // ✅ slower tick (~16fps)
    

scrollTimerRef.current = window.setInterval(() => {
  if (!scrollRef.current) return;

  scrollRef.current.scrollBy({
    top: step,
    behavior: "auto",
  });
}, intervalMs);

  };
  

  const stopOnManualScroll = () => {
    if (autoScrollDir !== null) {
      stopAutoScroll();
    }
  };
  
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      // no auto-scroll running → ignore
      if (autoScrollDir === null) return;
  
      const target = e.target as Node;
  
      // If click/tap is INSIDE button container → do nothing
      if (buttonsRef.current && buttonsRef.current.contains(target)) {
        return;
      }
  
      // Else clicked outside buttons → stop scrolling
      stopAutoScroll();
    };
  
    window.addEventListener("pointerdown", handlePointerDown);
  
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [autoScrollDir]);
  
  
  useEffect(() => {
    return () => stopAutoScroll();
  }, []);
  

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-grow overflow-y-auto p-4 bg-gray-50 dark:bg-[#111418]">
        {[...Array(10)].map((_, i) => (
          <VerseSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
      </div>
    );
  }

  // resolve version safely
  const resolveText = (v: Verse, version?: string): string => {
    if (!v?.text || !version) return "";
  
    return (
      v.text[version as keyof typeof v.text] ?? ""
    )
      .replace(/\s*\n+\s*/g, " ")
      .trim();
  };
  

  



  const isSingle = studyMode === "single";



  return (
<div
  ref={scrollRef}
  className="relative h-full w-full overflow-y-auto overflow-x-hidden p-4 md:p-6
 bg-gray-50 dark:bg-[#111418]"
  onScroll={(e) => {
    handleScroll(e);

    // ✅ DO NOT stop on programmatic scrolling
    // scrollBy() causes scroll event too, so ignore it
    if (isAutoScrollingRef.current) return;
  }}
  onWheel={stopOnManualScroll}      // ✅ mouse manual scroll stops
  onTouchMove={stopOnManualScroll}  // ✅ touch manual scroll stops
>




{/* ✅ Auto-scroll buttons (Top-left & Bottom-left) */}
<div
  ref={buttonsRef}
  className="
    fixed
    left-1 sm:left-2
    top-[120px] bottom-[90px]
    z-[20]
    flex flex-col justify-between
    pointer-events-none
  "
>



  {/* Scroll UP (TOP) */}
  <button
  type="button"
  className={`
    pointer-events-auto
    w-8 h-8 sm:w-9 sm:h-9
    rounded-full
    flex items-center justify-center
    shadow-sm
    backdrop-blur-md
    border
    transition
    opacity-60 hover:opacity-100
    ${
      autoScrollDir === "up"
        ? "bg-blue-600/70 text-white border-blue-500/60"
        : "bg-white/30 dark:bg-black/30 text-gray-800 dark:text-gray-200 border-white/40 dark:border-white/10"
    }
  `}
  title={autoScrollDir === "up" ? "Stop scroll" : "Scroll up"}
  onClick={() => toggleAutoScroll("up")}
>
  <i className="fas fa-chevron-up text-[12px]" />
</button>


  {/* Scroll DOWN (BOTTOM) */}
  <button
  type="button"
  className={`
    pointer-events-auto
    w-8 h-8 sm:w-9 sm:h-9
    rounded-full
    flex items-center justify-center
    shadow-sm
    backdrop-blur-md
    border
    transition
    opacity-60 hover:opacity-100
    ${
      autoScrollDir === "down"
        ? "bg-blue-600/70 text-white border-blue-500/60"
        : "bg-white/30 dark:bg-black/30 text-gray-800 dark:text-gray-200 border-white/40 dark:border-white/10"
    }
  `}
  title={autoScrollDir === "down" ? "Stop scroll" : "Scroll down"}
  onClick={() => toggleAutoScroll("down")}
>
  <i className="fas fa-chevron-down text-[12px]" />
</button>

</div>



      {/* Header — only ONE title in single mode
      {isSingle && (
  <div className="text-center mb-4">
    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
      {getBookNameByVersion(englishVersion)} {chapterNum}
    </h2>
  </div>
)}
      {!isSingle && (
  <div className="text-center mb-4">
    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
      {getParallelBookHeading()} {chapterNum}
    </h2>
  </div>
)}

 */}


      {/* -------------------------------
             SINGLE MODE RENDERING
         ------------------------------- */}
      {isSingle && (
        <div className="max-w-3xl mx-auto space-y-4">
          {verses.map((v) => {
            const isSel =
              selectedVerseRef?.verse === v.verse &&
              selectedVerseRef?.chapter === chapterNum;

            const hl = highlights[v.verse];

            return (
              <div
                id={`verse-${v.verse}`}
                key={v.verse}
                onClick={() => onVerseSelect(v.verse)}
                className={`p-2.5 sm:p-4 rounded-lg cursor-pointer transition-all ${
                  isSel
                    ? "border-2 border-blue-400 dark:border-blue-500"
                    : "hover:bg-gray-200 dark:hover:bg-[#1A1D21]"
                } ${getHighlightClass(hl)}`}
              >
                <span className="text-[15px] sm:text-lg font-semibold text-gray-500 dark:text-gray-400 mr-2">
                  {v.verse}
                </span>
                <span
  dir="ltr"
  className={`text-[1.12rem] sm:text-[1.22rem] md:text-[1.35rem]
    leading-relaxed sm:leading-loose
    text-gray-900 dark:text-gray-100
    ${englishVersion === TELUGU_VERSION_KEY ? "font-telugu" : ""}`}
>
  {resolveText(v, englishVersion)}
</span>




              </div>
            );
          })}
        </div>
      )}

      {/* -------------------------------
             PARALLEL MODE RENDERING
         ------------------------------- */}
      {!isSingle && (
        <div className="space-y-4">
          {verses.map((v) => {
            const isSel =
              selectedVerseRef?.verse === v.verse &&
              selectedVerseRef?.chapter === chapterNum;

            const hl = highlights[v.verse];

            return (
              <div
                id={`verse-${v.verse}`}
                key={v.verse}
                onClick={() => onVerseSelect(v.verse)}
                className={`p-2 sm:p-3 rounded-lg cursor-pointer transition-all ${
                  isSel
                    ? "border-2 border-blue-400 dark:border-blue-500"
                    : "hover:bg-gray-200 dark:hover:bg-[#1A1D21]"
                } ${getHighlightClass(hl)}`}
              >
                {/* Desktop → side-by-side, Mobile → stacked */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* LEFT version */}
                  {/* LEFT version (English) */}
<div className="flex gap-2">
<span className="text-sm sm:text-base font-semibold text-gray-500 dark:text-gray-400 mt-1">
  {v.verse}
</span>

  <p className="text-[1.05rem] sm:text-[1.12rem] md:text-[1.22rem]
  leading-relaxed sm:leading-loose
  text-gray-900 dark:text-gray-100">
  {resolveText(v, leftVersion)}
</p>


</div>

{/* RIGHT version (Telugu) */}
<div className="flex gap-2">
  <span className="text-base sm:text-lg font-semibold text-gray-500 dark:text-gray-400 mt-1">
    {v.verse}
  </span>
  <p
  className={`text-[1.05rem] sm:text-[1.12rem] md:text-[1.22rem]
    leading-relaxed sm:leading-loose
    ${rightVersion === TELUGU_VERSION_KEY ? "font-telugu" : ""}`}
>
  {resolveText(v, rightVersion)}
</p>



</div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
