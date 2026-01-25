// src/components/ScriptureDisplay.tsx
import React, { useEffect, useRef, useCallback, useState } from "react";
import { Verse, VerseReference } from "..";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import type { ReaderSettings } from "../hooks/useReaderSettings";

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
  readerSettings: ReaderSettings;

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
  readerSettings,
}) => {

  const getVerseFontClass = () => {
    switch (settings.fontSize) {
      case "sm":
        return "text-[0.90rem] sm:text-[0.95rem] md:text-[1.00rem]";
      case "md":
        return "text-[0.98rem] sm:text-[1.05rem] md:text-[1.12rem]";
      case "lg":
        return "text-[1.08rem] sm:text-[1.18rem] md:text-[1.30rem]";
      case "xl":
        return "text-[1.20rem] sm:text-[1.32rem] md:text-[1.48rem]";
      default:
        return "text-[0.98rem] sm:text-[1.05rem] md:text-[1.12rem]";
    }
  };
  

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
  const scrollTimerRef = useRef<number | null>(null); // will store requestAnimationFrame id
  const lastFrameTimeRef = useRef<number | null>(null);
  const accumulatedScrollRef = useRef(0);

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

const settings: ReaderSettings = readerSettings ?? {
  fontSize: "md",
  autoScrollSpeed: 1,
  autoScrollIntervalMs: 60,
  themeMode: "system",
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
      cancelAnimationFrame(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
  
    lastFrameTimeRef.current = null;
    accumulatedScrollRef.current = 0;
  
    isAutoScrollingRef.current = false;
    setAutoScrollDir(null);
  };
  
  

  const startAutoScroll = (direction: "up" | "down") => {
    stopAutoScroll();
  
    setAutoScrollDir(direction);
    isAutoScrollingRef.current = true;
  
    const speed = Math.max(1, Math.min(8, settings.autoScrollSpeed));
  
    // ✅ Slow + smooth scale
    // speed 1 = 8 px/sec
    // speed 8 = 60 px/sec
    const pixelsPerSecond = 4 + speed * 7;
  
    const stepSign = direction === "down" ? 1 : -1;
  
    const loop = (timestamp: number) => {
      if (!scrollRef.current) return;
  
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
      }
  
      const dt = (timestamp - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = timestamp;
  
      const delta = stepSign * pixelsPerSecond * dt;
  
      // ✅ Accumulate fractional pixels
      accumulatedScrollRef.current += delta;
  
      // ✅ Only scroll when we have at least 1 pixel
      const wholePixels = Math.trunc(accumulatedScrollRef.current);
  
      if (wholePixels !== 0) {
        scrollRef.current.scrollBy({
          top: wholePixels,
          behavior: "auto",
        });
  
        accumulatedScrollRef.current -= wholePixels;
      }
  
      scrollTimerRef.current = requestAnimationFrame(loop);
    };
  
    scrollTimerRef.current = requestAnimationFrame(loop);
  };
     
  const toggleAutoScroll = (direction: "up" | "down") => {
    // Tap again = stop
    if (autoScrollDir === direction) {
      stopAutoScroll();
      return;
    }
  
    // Else start / switch direction
    startAutoScroll(direction);
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
    if (autoScrollDir === null) return;
  
    // restart auto-scroll using latest speed/interval values
    startAutoScroll(autoScrollDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoScrollSpeed]);

  
  
  useEffect(() => {
    return () => stopAutoScroll();
  }, []);
  

  // Loading state
  if (isLoading) {
    return (
<div className="flex-grow overflow-y-auto p-4 bg-slate-50 dark:bg-[#0B0F14]">

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
  className="
  relative h-full w-full overflow-y-auto overflow-x-hidden
  p-2 md:p-3
  bg-slate-50 dark:bg-[#0B0F14]
"

 onScroll={(e) => {
  // ignore scroll events triggered by auto-scrolling
  if (isAutoScrollingRef.current) return;

  handleScroll(e);
}}

  onWheel={stopOnManualScroll}      // ✅ mouse manual scroll stops
  onTouchMove={stopOnManualScroll}  // ✅ touch manual scroll stops
>




{/* ✅ Auto-scroll buttons (Top-left & Bottom-left) */}
<div
  ref={buttonsRef}
  className="
    pointer-events-none
    fixed
    z-[30]
    flex flex-col justify-between

    /* Mobile positioning */
    right-3 top-[140px] bottom-[110px]

    /* Desktop positioning:
       Push it LEFT by the width of right panel (1/3)
       so it stays INSIDE scripture panel area */
    md:right-[calc(33.333vw+16px)]
    md:top-[180px]
    md:bottom-[60px]
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
shadow-lg
backdrop-blur-xl
border
transition-all duration-150
opacity-70 hover:opacity-100


    md:-mt-10  /* ✅ move only UP arrow up in desktop */

    ${
      autoScrollDir === "up"
        ? "bg-blue-600/70 text-white border-blue-500/60"
        : "bg-white/60 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 border-slate-200/60 dark:border-white/10"

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
        <div
        className="
          max-w-3xl mx-auto space-y-2
          bg-white dark:bg-gray-900
          border border-slate-200 dark:border-white/10
          rounded-[2rem]
          shadow-sm
          p-2 sm:p-6
        "
      >
      
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
                className={`
                  p-2 sm:p-3
                  rounded-2xl
                  cursor-pointer
                  transition-all duration-150
                  border
                  ${
                    isSel
                      ? "border-blue-500/60 bg-blue-50/60 dark:bg-blue-900/20 ring-2 ring-blue-500/30"
                      : "border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-100/80 dark:hover:bg-slate-800/40"
                  }
                  ${getHighlightClass(hl)}
                `}
                
              >
<span className="text-[13px] sm:text-[14px] font-semibold text-gray-500 dark:text-gray-400 mr-2">
  {v.verse}
</span>

<span
  dir="ltr"
  className={`
    ${getVerseFontClass()}
    text-gray-900 dark:text-gray-100
    ${
      englishVersion === TELUGU_VERSION_KEY
        ? `font-telugu leading-[1.85] tracking-[0.2px] ${
            isSel ? "font-medium" : "font-normal"
          }`
        : `font-sans leading-relaxed sm:leading-relaxed md:leading-relaxed ${
            isSel ? "font-medium" : "font-normal"
          }`
    }
  `}
  
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
        <div
        className="
          space-y-4
          bg-white dark:bg-slate-900
          border border-slate-200 dark:border-white/10
          rounded-[2rem]
          shadow-sm
          p-2 sm:p-6
        "
      >
      
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
                className={`
                  p-2 sm:p-3
                  rounded-2xl
                  cursor-pointer
                  transition-all duration-150
                  border
                  ${
                    isSel
                      ? "border-blue-500/50 bg-blue-50/60 dark:bg-blue-900/20 ring-2 ring-blue-500/40"
                      : "border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-100/80 dark:hover:bg-slate-800/40"
                  }
                  ${getHighlightClass(hl)}
                `}
                
              >
                {/* Desktop → side-by-side, Mobile → stacked */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* LEFT version */}
                  {/* LEFT version (English) */}
<div className="flex gap-2">
<span className="text-sm sm:text-base font-semibold text-gray-500 dark:text-gray-400 mt-1">
  {v.verse}
</span>

<p
  className={`
    ${getVerseFontClass()}
    font-sans
    leading-relaxed sm:leading-relaxed
    text-gray-900 dark:text-gray-100
    ${isSel ? "font-medium" : "font-normal"}
  `}
  
>


  {resolveText(v, leftVersion)}
</p>


</div>

{/* RIGHT version (Telugu) */}
<div className="flex gap-2">
  <span className="text-base sm:text-base font-semibold text-gray-500 dark:text-gray-400 mt-1">
    {v.verse}
  </span>
  <p
  className={`
    ${getVerseFontClass()}
    ${
      rightVersion === TELUGU_VERSION_KEY
        ? `font-telugu leading-[1.85] tracking-[0.2px] ${
            isSel ? "font-medium" : "font-normal"
          }`
        : `font-sans leading-relaxed sm:leading-relaxed ${
            isSel ? "font-medium" : "font-normal"
          }`
    }
  `}
  
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
