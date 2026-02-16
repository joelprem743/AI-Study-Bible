// src/components/ScriptureDisplay.tsx
import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { Verse, VerseReference } from "..";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import type { ReaderSettings } from "../hooks/useReaderSettings";
import { useNotes } from "../context/NotesContext";
import { generateVerseImage } from "../utils/verseImage";
import ModalPortal from "./ModalPortal";
import VerseImageShare from "./VerseImageShare";
import { buildVerseShareCaption, buildVerseShareUrl } from "../utils/share";
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
  onHighlightVerse: (verseNum: number, color: string | null) => void;

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
  onHighlightVerse, 
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

  const GRADIENT_PRESETS = [
    { id: "slate", from: "#f8fafc", to: "#e5e7eb" },
    { id: "sky", from: "#e0f2fe", to: "#bae6fd" },
    { id: "lavender", from: "#ede9fe", to: "#ddd6fe" },
    { id: "mint", from: "#ecfeff", to: "#cffafe" },
    { id: "sand", from: "#fffbeb", to: "#fef3c7" },
    { id: "rose", from: "#fff1f2", to: "#ffe4e6" },
  ];
  
  

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

  // ============================================
  // ALL HOOKS MUST BE CALLED FIRST (Rules of Hooks)
  // ============================================
  
  // Refs
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const accumulatedScrollRef = useRef(0);
  const isAutoScrollingRef = useRef(false);
  const buttonsRef = useRef<HTMLDivElement | null>(null);
  const lastScroll = useRef(0);
  const lastSelectedVerseRef = useRef<number | null>(null);
  const mouseLongPressTimerRef = useRef<number | null>(null);
  const isMouseLongPressRef = useRef(false);
  
  // Multi-select refs
  const longPressTimerRef = useRef<Map<number, number>>(new Map());
  const touchMovedRef = useRef<Map<number, boolean>>(new Map());

  // State
  const [autoScrollDir, setAutoScrollDir] = useState<"up" | "down" | null>(null);
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [shareStep, setShareStep] = useState<"background" | "content" | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [selectedGradient, setSelectedGradient] = useState<{ from: string; to: string } | null>(null);
  const [shareVerseData, setShareVerseData] = useState<{
    verseRef: VerseReference;
    verseText: string;
    language: "EN" | "TE";
    rangeEnd?: number;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);
// Highlight dropdown state (copied from VerseTools)
const highlightRef = useRef<HTMLDivElement | null>(null);
const highlightButtonRef = useRef<HTMLButtonElement | null>(null);

const [highlightOpen, setHighlightOpen] = useState(false);
const [previewHighlight, setPreviewHighlight] =
  useState<string | null>(null);

// 🔥 LONG PRESS DRAG SUPPORT
const longPressHighlightTimerRef = useRef<number | null>(null);
const isLongPressActiveRef = useRef(false);
const pendingHighlightRef = useRef<string | null>(null);



  
  
  const touchStartYRef = useRef<Map<number, number>>(new Map());

  const gradientSectionRef = useRef<HTMLDivElement | null>(null);

  const NATURE_BACKGROUNDS = [
    { id: "1", name: "Mountain Sunrise", url: "/verse-bg/mountain-sunrise.png" },
    { id: "2", name: "Ocean Waves", url: "/verse-bg/ocean-waves.png" },
    { id: "3", name: "Forest Path", url: "/verse-bg/forest-path.png" },
    { id: "4", name: "Desert Dunes", url: "/verse-bg/desert-dunes.png" },
    { id: "5", name: "Mountain Lake", url: "/verse-bg/mountain-lake.png" },
    { id: "6", name: "Sunset Fields", url: "/verse-bg/sunset-fields.png" },
    { id: "7", name: "Coastal Cliffs", url: "/verse-bg/coastal-cliffs.png" },
    { id: "8", name: "Autumn Forest", url: "/verse-bg/autumn-forest.png" },
    { id: "9", name: "Mountain Peak", url: "/verse-bg/mountain-peak.png" },
    { id: "10", name: "Peaceful Meadow", url: "/verse-bg/peaceful-meadow.png" },
    { id: "11", name: "Bible Cross", url: "/verse-bg/bible-cross.png" },
    { id: "12", name: "Blurry Grass", url: "/verse-bg/blurry-grass.png" },
    { id: "13", name: "Blurry River", url: "/verse-bg/blurry-river.png" },
    { id: "14", name: "Calm Horizon Light", url: "/verse-bg/calm-horizon-light.png" },
    { id: "15", name: "Coastal View", url: "/verse-bg/coastal-view.png" },
    { id: "16", name: "Desert Cross (Dark)", url: "/verse-bg/dark-desert-distant-cross.png" },
    { id: "17", name: "Light Gradient Cross", url: "/verse-bg/light-gradient-negative-cross.png" },
    { id: "18", name: "Old Bible", url: "/verse-bg/old-bible.png" },
    { id: "19", name: "Open Bible (Top View)", url: "/verse-bg/openbible-top.png" },
    { id: "20", name: "Soft Desert", url: "/verse-bg/soft-desert.png" },
    { id: "21", name: "Soft Forest Light Rays", url: "/verse-bg/soft-forest-light-rays.png" },
    { id: "22", name: "Implied Light Cross", url: "/verse-bg/soft-light-implied-cross.png" },
    { id: "23", name: "Soft Sky Pastel Gradient", url: "/verse-bg/soft-sky-pastel-gradient.png" },
  ];
  
  

  // Context
  const { saveNoteFor } = useNotes();

  // Derived values (safe to compute after hooks)
  const settings: ReaderSettings = readerSettings ?? {
    fontSize: "md",
    autoScrollSpeed: 1,
    autoScrollIntervalMs: 60,
    themeMode: "system",
  };

  const isTeluguVersion = useCallback((version?: string) =>
    version === TELUGU_VERSION_KEY, []);

  const getBookNameByVersion = useCallback((version?: string) => {
    if (isTeluguVersion(version)) {
      return TELUGU_BOOK_NAMES[bookName] || bookName;
    }
    return bookName;
  }, [bookName, isTeluguVersion]);

  const getParallelBookHeading = useCallback(() => {
    const left = getBookNameByVersion(leftVersion);
    const right = getBookNameByVersion(rightVersion);
    return left === right ? left : `${left}–${right}`;
  }, [leftVersion, rightVersion, getBookNameByVersion]);

  const resolveText = useCallback((v: Verse, version?: string): string => {
    if (!v?.text || !version) return "";
    return (
      v.text[version as keyof typeof v.text] ?? ""
    )
      .replace(/\s*\n+\s*/g, " ")
      .trim();
  }, []);
  

  const isSingle = useMemo(() => studyMode === "single", [studyMode]);


  const lockScroll = () => {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
  };
  
  const unlockScroll = () => {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  };
  
  useEffect(() => {
    if (!highlightOpen) return;
  
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
  
      if (highlightButtonRef.current?.contains(target)) return;
      if (highlightRef.current?.contains(target)) return;
  
      setHighlightOpen(false);
    };
  
    document.addEventListener("mousedown", handleOutside);
  
    return () => {
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [highlightOpen]);
  
  
  

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


  // Scroll handler
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

  // Multi-select handlers
  const handleVerseLongPress = useCallback((verseNum: number) => {
    setIsSelectionMode(true);
  
    setSelectedVerses((prev) => {
      const next = new Set(prev);
      next.add(verseNum);
      return next;
    });
  
    // Do NOT auto-open highlight.
  }, []);

  

  const handleVerseClick = useCallback(
    (verseNum: number, e: React.MouseEvent | React.TouchEvent) => {
  
      // 🔥 If long press triggered, swallow click completely
      if (isMouseLongPressRef.current) {
        isMouseLongPressRef.current = false;
        return;
      }
  
      if (!isSelectionMode) {
        onVerseSelect(verseNum);
        return;
      }
  
      e.preventDefault();
      e.stopPropagation();
  
  
      const mouseEvent = e as React.MouseEvent;
  
      // SHIFT range selection (desktop only)
      if (
        mouseEvent.shiftKey &&
        lastSelectedVerseRef.current !== null
      ) {
        const start = Math.min(lastSelectedVerseRef.current, verseNum);
        const end = Math.max(lastSelectedVerseRef.current, verseNum);
  
        setSelectedVerses((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) {
            next.add(i);
          }
          return next;
        });
      } else {
        setSelectedVerses((prev) => {
          const next = new Set(prev);
          if (next.has(verseNum)) {
            next.delete(verseNum);
          } else {
            next.add(verseNum);
          }
          return next;
        });
      }
  
      lastSelectedVerseRef.current = verseNum;
    },
    [isSelectionMode, onVerseSelect]
  );
  
  const handleMouseDown = useCallback((verseNum: number) => {
    isMouseLongPressRef.current = false;
  
    mouseLongPressTimerRef.current = window.setTimeout(() => {
      isMouseLongPressRef.current = true;
      handleVerseLongPress(verseNum);
    }, 350);
  }, [handleVerseLongPress]);
  
  const handleMouseUp = useCallback(() => {
    if (mouseLongPressTimerRef.current) {
      clearTimeout(mouseLongPressTimerRef.current);
      mouseLongPressTimerRef.current = null;
    }
  
    // IMPORTANT: do NOT reset isMouseLongPressRef here
  }, []);
  
  
  const handleMouseLeave = useCallback(() => {
    if (mouseLongPressTimerRef.current) {
      clearTimeout(mouseLongPressTimerRef.current);
      mouseLongPressTimerRef.current = null;
    }
  }, []);
  

  const clearSelection = useCallback(() => {
    setSelectedVerses(new Set());
    setIsSelectionMode(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectionMode) {
        clearSelection();
      }
    };
  
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectionMode, clearSelection]);
  

  const handleTouchStart = useCallback((verseNum: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartYRef.current.set(verseNum, touch.clientY);
    touchMovedRef.current.set(verseNum, false);
  
    const timer = window.setTimeout(() => {
      if (!touchMovedRef.current.get(verseNum)) {
        handleVerseLongPress(verseNum);
      }
    }, 350); // shorter = better UX
  
    longPressTimerRef.current.set(verseNum, timer);
  }, [handleVerseLongPress]);
  
  
  const handleTouchMove = useCallback((verseNum: number, e: React.TouchEvent) => {
    const startY = touchStartYRef.current.get(verseNum);
    if (!startY) return;
  
    const currentY = e.touches[0].clientY;
  
    // Only cancel if user scrolls more than 12px
    if (Math.abs(currentY - startY) > 12) {
      touchMovedRef.current.set(verseNum, true);
    }
  }, []);

  
  const handleTouchEnd = useCallback(
    (verseNum: number, e: React.TouchEvent) => {
      const timer = longPressTimerRef.current.get(verseNum);
  
      if (timer) {
        clearTimeout(timer);
        longPressTimerRef.current.delete(verseNum);
      }
  
      const moved = touchMovedRef.current.get(verseNum);
  
      // Only treat as click if not long press and not moved
      if (!isSelectionMode && !moved) {
        handleVerseClick(verseNum, e);
      }
  
      touchMovedRef.current.delete(verseNum);
      touchStartYRef.current.delete(verseNum);
    },
    [isSelectionMode, handleVerseClick]
  );
  

  // Share as text
  const handleShareAsText = useCallback(async () => {
    if (selectedVerses.size === 0) return;

    const sortedVerses = Array.from(selectedVerses).sort((a, b) => a - b);
    const selectedVersesData = verses.filter((v) => sortedVerses.includes(v.verse));
    
    const bookDisplayName = isTeluguVersion(englishVersion)
      ? TELUGU_BOOK_NAMES[bookName] || bookName
      : bookName;

    const refRange = sortedVerses.length === 1
      ? `${bookDisplayName} ${chapterNum}:${sortedVerses[0]}`
      : `${bookDisplayName} ${chapterNum}:${sortedVerses[0]}-${sortedVerses[sortedVerses.length - 1]}`;

    const verseTexts = selectedVersesData
      .map((v) => {
        const text = resolveText(v, englishVersion);
        return `${v.verse} ${text}`;
      })
      .join("\n\n");

      const caption = buildVerseShareCaption(
        bookName,
        chapterNum,
        sortedVerses[0]
      );
      
      const shareText =
        `${refRange}\n\n${verseTexts}\n\n${caption}`;
    if (navigator.share) {
      try {
        await navigator.share({
          text: shareText,
          url: buildVerseShareUrl(
            bookName,
            chapterNum,
            sortedVerses[0]
          ),
        });
        clearSelection();
        return;
      } catch (err) {
        console.error("Native share failed:", err);
      }
    }

    await navigator.clipboard.writeText(shareText);
    clearSelection();
  }, [selectedVerses, verses, bookName, chapterNum, englishVersion, isTeluguVersion, resolveText, clearSelection]);

  // Share as image (for first selected verse only)
  const MAX_IMAGE_VERSES = 2;
  const MAX_IMAGE_CHARS = 550;
  
  const handleShareAsImage = useCallback(() => {
    if (selectedVerses.size === 0) return;
  
    const sorted = Array.from(selectedVerses).sort((a, b) => a - b);
  
    // 🚫 Hard verse limit
    if (sorted.length > MAX_IMAGE_VERSES) {
      setToast({
        message: "You can share only up to 2 verses as image.",
        type: "error",
      });
    
      setTimeout(() => setToast(null), 2500);
      return;
    }
    
  
    const selectedVersesData = verses.filter((v) =>
      sorted.includes(v.verse)
    );
  
    const combinedText = selectedVersesData
    .map((v) =>
      resolveText(v, englishVersion)
        .replace(/¸/g, "") // remove garbage encoding
        .trim()
    )
    .join(" "); // single continuous flow
  
  
    // 🚫 Character guard
    if (combinedText.length > MAX_IMAGE_CHARS) {
      setToast({
        message: "Too much text for image. Please select shorter verses.",
        type: "error",
      });
    
      setTimeout(() => setToast(null), 2500);
      return;
    }
    
  
    const language = isTeluguVersion(englishVersion) ? "TE" : "EN";
  
    const verseRef = {
      book: bookName,
      chapter: chapterNum,
      verse: sorted[0], // anchor
    };
  
    setShareVerseData({
      verseRef,
      verseText: combinedText,
      language,
      rangeEnd: sorted.length > 1 ? sorted[sorted.length - 1] : undefined,
    });
//     console.log("Selected verses data:", selectedVersesData);
//     console.log("All verses array:", verses);
//     console.log("Filtered selected:", selectedVersesData);
//     console.log("Combined text raw:");
// console.log(combinedText);
// console.log(
//   selectedVersesData.map(v => ({
//     verse: v.verse,
//     text: resolveText(v, englishVersion)
//   }))
// );

    
    setShareStep("background");
    setShowActionsMenu(false);
  }, [
    selectedVerses,
    verses,
    bookName,
    chapterNum,
    englishVersion,
    isTeluguVersion,
    resolveText,
  ]);
  
  const handleMultiHighlight = useCallback(
    (color: string | null) => {
      selectedVerses.forEach((verseNum) => {
        onHighlightVerse(verseNum, color);
      });
  
      setPreviewHighlight(null);
      setHighlightOpen(false);
    },
    [selectedVerses, onHighlightVerse]
  );
  
  
  // Add to notes
const handleAddToNotes = useCallback(() => {
  if (selectedVerses.size === 0) return;

  const sorted = Array.from(selectedVerses).sort((a, b) => a - b);
  const selectedVersesData = verses.filter(v =>
    sorted.includes(v.verse)
  );

  const languageIsTE = isTeluguVersion(englishVersion);

  const displayBook =
    languageIsTE
      ? TELUGU_BOOK_NAMES[bookName] || bookName
      : bookName;

  const combinedText = selectedVersesData
    .map(v => resolveText(v, englishVersion))
    .join("\n\n");

  window.dispatchEvent(
    new CustomEvent("open-profile-notes", {
      detail: {
        ref: {
          book: bookName,
          displayBook,
          chapter: chapterNum,
          verseStart: sorted[0],
          verseEnd: sorted.length > 1 ? sorted[sorted.length - 1] : undefined,
        },
        text: combinedText,
      },
    })
  );

  clearSelection();
}, [
  selectedVerses,
  verses,
  bookName,
  chapterNum,
  englishVersion,
  isTeluguVersion,
  resolveText,
  clearSelection,
]);

  


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
  onTouchMove={(e) => {
    // Only stop auto-scroll if actually auto-scrolling
    if (autoScrollDir !== null) {
      stopOnManualScroll();
    }
  }}
    // ✅ touch manual scroll stops
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
              selectedVerseRef?.chapter === chapterNum &&
              !isSelectionMode;
            const isMultiSelected = isSelectionMode && selectedVerses.has(v.verse);
            const baseHighlight = highlights[v.verse];
            const effectiveHighlight =
              previewHighlight && selectedVerses.has(v.verse)
                ? previewHighlight
                : baseHighlight;
            

            return (
              <div
                id={`verse-${v.verse}`}
                key={v.verse}
                onClick={(e) => handleVerseClick(v.verse, e)}
                onMouseDown={() => handleMouseDown(v.verse)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={(e) => handleTouchStart(v.verse, e)}
                onTouchMove={(e) => handleTouchMove(v.verse, e)}
                onTouchEnd={(e) => handleTouchEnd(v.verse, e)}
                className={`
                  p-2 sm:p-3
                  rounded-2xl
                  cursor-pointer
                  transition-all duration-150
                  border
                  ${
                    isMultiSelected
                      ? "border-blue-600 bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500"
                      : isSel
                      ? "border-blue-500/60 bg-blue-50/60 dark:bg-blue-900/20 ring-2 ring-blue-500/30"
                      : "border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-100/80 dark:hover:bg-slate-800/40"
                  }
                  ${getHighlightClass(effectiveHighlight)}
                `}
                
              >
<span className="text-[13px] sm:text-[14px] font-semibold text-gray-500 dark:text-gray-400 mr-2">
  {v.verse}
</span>

                <span
  dir="ltr"
  className={`
    ${getVerseFontClass()}
    leading-relaxed sm:leading-relaxed md:leading-loose
    text-gray-900 dark:text-gray-100
    ${
      englishVersion === TELUGU_VERSION_KEY
        ? "font-telugu leading-[1.85] tracking-[0.2px]"
        : ""
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
              selectedVerseRef?.chapter === chapterNum &&
              !isSelectionMode;
            const isMultiSelected = isSelectionMode && selectedVerses.has(v.verse);
            const baseHighlight = highlights[v.verse];
            const effectiveHighlight =
              previewHighlight && selectedVerses.has(v.verse)
                ? previewHighlight
                : baseHighlight;
            

            return (
              <div
                id={`verse-${v.verse}`}
                key={v.verse}
                onMouseDown={() => handleMouseDown(v.verse)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}                
                onClick={(e) => handleVerseClick(v.verse, e)}
                onTouchStart={(e) => handleTouchStart(v.verse, e)}
                onTouchMove={(e) => handleTouchMove(v.verse, e)}
                onTouchEnd={(e) => handleTouchEnd(v.verse, e)}
                className={`
                  p-2 sm:p-3
                  rounded-2xl
                  cursor-pointer
                  transition-all duration-150
                  border
                  ${
                    isMultiSelected
                      ? "border-blue-600 bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500"
                      : isSel
                      ? "border-blue-500/50 bg-blue-50/60 dark:bg-blue-900/20 ring-2 ring-blue-500/40"
                      : "border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-100/80 dark:hover:bg-slate-800/40"
                  }
                  ${getHighlightClass(effectiveHighlight)}
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
    leading-relaxed sm:leading-loose
    text-gray-900 dark:text-gray-100
  `}
>

  {resolveText(v, leftVersion)}
</p>


</div>

{/* RIGHT version (Telugu) */}
<div className="flex gap-2">
  <span className="text-base sm:text-lg font-semibold text-gray-500 dark:text-gray-400 mt-1">
    {v.verse}
  </span>
  <p
  className={`
    ${getVerseFontClass()}
    leading-relaxed sm:leading-loose
    ${
      rightVersion === TELUGU_VERSION_KEY
        ? "font-telugu leading-[1.85] tracking-[0.2px]"
        : ""
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

{/* Multi-select action menu */}
{isSelectionMode && selectedVerses.size > 0 && (
  <ModalPortal>
    <div className="fixed inset-0 z-[9998] pointer-events-none">

{/* MOBILE ACTION BAR */}
<div className="fixed bottom-4 left-0 right-0 px-4 sm:hidden pointer-events-auto">
  <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 p-4">

  <div className="flex justify-between items-center mb-3">
  <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
    {selectedVerses.size} Verse{selectedVerses.size > 1 ? "s" : ""} Selected
  </div>

  <button
    onClick={clearSelection}
    className="text-xs font-semibold text-red-600 dark:text-red-400"
  >
    Clear
  </button>
</div>

<div className="flex gap-3 items-center">

    <div className="relative" ref={highlightRef}>
    <button
  ref={highlightButtonRef}
  className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700"
  onClick={(e) => {
    if (isLongPressActiveRef.current) return;
    e.stopPropagation();
    setHighlightOpen((v) => !v);
  }}

  onTouchStart={() => {
    longPressHighlightTimerRef.current = window.setTimeout(() => {
      isLongPressActiveRef.current = true;
      pendingHighlightRef.current = null;
      setPreviewHighlight(null);
      lockScroll();
      setHighlightOpen(true);
    }, 350);
  }}

  onTouchMove={(e) => {
    if (!isLongPressActiveRef.current) return;

    const touch = e.touches[0];
    const el = document.elementFromPoint(
      touch.clientX,
      touch.clientY
    );

    if (!(el instanceof HTMLElement)) return;

    const color = el.dataset.highlightColor;
    if (color) {
      const resolved = color === "clear" ? null : color;
      pendingHighlightRef.current = resolved;
      setPreviewHighlight(resolved);
    }
  }}

    onTouchEnd={() => {
      if (longPressHighlightTimerRef.current) {
        clearTimeout(longPressHighlightTimerRef.current);
        longPressHighlightTimerRef.current = null;
      }

      if (isLongPressActiveRef.current) {
        handleMultiHighlight(pendingHighlightRef.current);
        unlockScroll();
        setHighlightOpen(false);
      }

      isLongPressActiveRef.current = false;
      pendingHighlightRef.current = null;
      setPreviewHighlight(null);
    }}

  onTouchCancel={() => {
    if (longPressHighlightTimerRef.current) {
      clearTimeout(longPressHighlightTimerRef.current);
    }

    unlockScroll();
    isLongPressActiveRef.current = false;
    pendingHighlightRef.current = null;
    setHighlightOpen(false);
  }}
>
  <i className="fas fa-highlighter" />
</button>


  {highlightOpen && (
    <div className="absolute bottom-12 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-3 z-[9999]">
      <div className="flex gap-2">
      {["yellow","green","pink","blue"].map((color) => (
          <button
            key={color}
            data-highlight-color={color}
            onMouseEnter={() => setPreviewHighlight(color)}
            onMouseLeave={() => setPreviewHighlight(null)}
            onClick={() => handleMultiHighlight(color)}
            className={`w-7 h-7 rounded-full ${
              color === "yellow"
                ? "bg-yellow-300"
                : color === "green"
                ? "bg-green-300"
                : color === "pink"
                ? "bg-rose-300"
                : "bg-sky-300"
            }`}
          />
        ))}
      </div>

      <button
  data-highlight-color="clear"
  onMouseEnter={() => setPreviewHighlight(null)}
  onClick={() => handleMultiHighlight(null)}
  className="mt-3 w-full text-xs py-1 rounded-xl bg-slate-100 dark:bg-slate-800"
>
  Clear
</button>

    </div>
  )}
</div>

      <button
        onClick={handleShareAsText}
        className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-medium"
      >
        Share
      </button>

      <button
        onClick={handleAddToNotes}
        className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-medium"
      >
        Save
      </button>

      <button
        onClick={() => setShowActionsMenu(true)}
        className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-medium"
      >
        More
      </button>

    </div>

  </div>
</div>


      {/* ================= DESKTOP ================= */}
      <div className="hidden sm:block fixed bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 p-4 flex items-center gap-3">

          <button
            onClick={clearSelection}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
          <div className="relative" ref={highlightRef}>
  <button
    ref={highlightButtonRef}
    onClick={(e) => {
  e.stopPropagation();
  setHighlightOpen((v) => !v);
}}

    className="px-4 py-2 text-sm font-semibold bg-slate-200 dark:bg-slate-700 rounded-xl"
  >
    <i className="fas fa-highlighter mr-1" />
    Highlight
  </button>

  {highlightOpen && (
    <div className="absolute bottom-12 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-3 z-[9999]">
      <div className="flex gap-2">
        {["yellow","green","pink","blue"].map((color) => (
          <button
            key={color}
            onMouseEnter={() => setPreviewHighlight(color)}
            onMouseLeave={() => setPreviewHighlight(null)}
            onClick={() => handleMultiHighlight(color)}
            
            className={`w-7 h-7 rounded-full ${
              color === "yellow"
                ? "bg-yellow-300"
                : color === "green"
                ? "bg-green-300"
                : color === "pink"
                ? "bg-rose-300"
                : "bg-sky-300"
            }`}
          />
        ))}
      </div>

      <button
onMouseEnter={() => setPreviewHighlight(null)}
onClick={() => handleMultiHighlight(null)}

        className="mt-3 w-full text-xs py-1 rounded-xl bg-slate-100 dark:bg-slate-800"
      >
        Clear
      </button>
    </div>
  )}
</div>


          <button
            onClick={handleShareAsImage}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
          >
            Share as Image
          </button>

          <button
            onClick={handleShareAsText}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
          >
            Share as Text
          </button>

          <button
            onClick={handleAddToNotes}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
          >
            Add to Notes
          </button>

          <div className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {selectedVerses.size} selected
          </div>

        </div>
      </div>

      {/* ================= MOBILE ACTION SHEET ================= */}
      {showActionsMenu && (
        <div className="fixed inset-0 z-[9999] pointer-events-auto">

          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowActionsMenu(false)}
          />

          {/* Sheet */}
          <div
            className="
              absolute bottom-0 left-0 right-0
              bg-white dark:bg-slate-900
              rounded-t-3xl
              shadow-2xl
              p-6
              animate-slide-up
            "
          >
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-6" />

            <div className="flex flex-col gap-3">

              <button
                onClick={() => {
                  handleShareAsImage();
                  setShowActionsMenu(false);
                }}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium"
              >
                Share as Image
              </button>

              <button
                onClick={() => {
                  handleShareAsText();
                  setShowActionsMenu(false);
                }}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium"
              >
                Share as Text
              </button>

              <button
                onClick={() => {
                  handleAddToNotes();
                  setShowActionsMenu(false);
                }}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium"
              >
                Add to Notes
              </button>

              <button
                onClick={() => {
                  clearSelection();
                  setShowActionsMenu(false);
                }}
                className="w-full py-3 rounded-xl bg-slate-200 dark:bg-slate-700 font-medium"
              >
                Cancel
              </button>

            </div>
          </div>
        </div>
      )}

    </div>
  </ModalPortal>
)}

{shareStep === "background" && (
  <ModalPortal>
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
      onClick={() => setShareStep(null)}
    >
      <div
        className="
          bg-white dark:bg-slate-900
          rounded-[1.75rem]
          shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)]
          w-11/12 max-w-2xl
          max-h-[85vh] overflow-y-auto
          p-7
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="
            -mx-7 -mt-7 mb-6
            px-7 py-5
            rounded-t-[1.75rem]
            bg-gradient-to-b from-slate-900 to-slate-800
            text-white
            flex items-center justify-between
          "
        >
          <div>
            <h3 className="text-sm font-semibold tracking-wide">
              Share verse beautifully
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Choose a background style
            </p>
          </div>

          <button
            onClick={() => setShareStep(null)}
            className="
              w-9 h-9 rounded-full
              bg-white/10 hover:bg-white/20
              flex items-center justify-center
              transition
            "
          >
            ✕
          </button>
        </div>

        {/* Background choices */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5 mb-6">

          {/* Gradient option card */}
          <button
            onClick={() => {
              setSelectedBackground(null);
              const first = GRADIENT_PRESETS[0];
              setSelectedGradient(first);

              setTimeout(() => {
                if (gradientSectionRef.current) {
                  gradientSectionRef.current.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }
              }, 0);
            }}
            className={`
              relative aspect-square rounded-xl overflow-hidden border-2 transition-all
              ${
                selectedBackground === null
                  ? "border-blue-600 ring-2 ring-blue-300"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }
            `}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 via-sky-300 to-blue-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fas fa-palette text-2xl text-white/80" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1.5 text-center font-semibold">
              Gradient
            </div>
          </button>

          {/* Image options */}
          {NATURE_BACKGROUNDS.map((bg) => (
            <button
              key={bg.id}
              onClick={() => {
                setSelectedBackground(bg.url);
                setSelectedGradient(null);
                setShareStep("content");
              }}
              className="
                relative aspect-square rounded-2xl overflow-hidden
                border border-slate-200 dark:border-slate-700
                hover:scale-[1.03] hover:shadow-lg
                transition
              "
            >
              <img
                src={bg.url}
                className="w-full h-full object-cover"
                alt={bg.name}
              />
              <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] py-1 text-center truncate">
                {bg.name}
              </div>
            </button>
          ))}
        </div>

        {/* Gradient presets */}
        <div ref={gradientSectionRef}>
          <p className="text-xs font-semibold mb-2 text-slate-600 dark:text-slate-300">
            Gradient colors
          </p>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 flex-nowrap">
              {GRADIENT_PRESETS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setSelectedBackground(null);
                    setSelectedGradient({ from: g.from, to: g.to });
                    setShareStep("content");
                  }}
                  className={`
                    w-14 h-14 rounded-xl flex-shrink-0 border
                    ${
                      selectedGradient &&
                      selectedGradient.from === g.from &&
                      selectedGradient.to === g.to
                        ? "border-blue-500 ring-2 ring-blue-400/60"
                        : "border-slate-300 dark:border-slate-700"
                    }
                  `}
                  style={{
                    background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShareStep(null)}
          className="
            mt-6 w-full
            py-3 rounded-xl
            text-sm font-semibold
            bg-slate-100 dark:bg-slate-800
            border border-slate-200 dark:border-slate-700
            hover:bg-slate-200 dark:hover:bg-slate-700
            transition
          "
        >
          Cancel
        </button>
      </div>
    </div>
  </ModalPortal>
)}

{shareStep === "content" && shareVerseData && (
  <ModalPortal>
    <VerseImageShare
      verseRef={shareVerseData.verseRef}
      verseText={shareVerseData.verseText}
      language={shareVerseData.language}
      backgroundUrl={selectedBackground}
      gradient={selectedGradient}
      rangeEnd={shareVerseData.rangeEnd}
      onClose={() => {
        setShareStep(null);
        setShareVerseData(null);
        clearSelection();
      }}
      onBack={() => setShareStep("background")}
    />
  </ModalPortal>
)}

{toast && (
  <div
    className={`
      fixed bottom-6 left-1/2 -translate-x-1/2
      px-5 py-3 rounded-2xl shadow-xl
      text-sm font-semibold
      z-[10000]
      transition
      ${
        toast.type === "error"
          ? "bg-red-600 text-white"
          : "bg-green-600 text-white"
      }
    `}
  >
    {toast.message}
  </div>
)}


    </div>
  );
};
