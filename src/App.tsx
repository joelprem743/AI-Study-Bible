// src/App.tsx
import React, { useState, useEffect, useCallback, FormEvent } from "react";

import NavigationPane from "./components/NavigationPane";
import { ScriptureDisplay } from "./components/ScriptureDisplay";
import { VerseTools } from "./components/VerseTools";
import { Chatbot } from "./components/Chatbot";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { SearchResultDisplay } from "./components/SearchResultDisplay";
import ProfileNotes from "./components/ProfileNotes";

import { useLocalStorage } from "./hooks/useLocalStorage";
import { useHighlights } from "./hooks/useHighlights";
import { useThemeMode } from "./hooks/useThemeMode";
import DemoTourOverlay from "./components/DemoTourOverlay";
import { DEMO_STEPS } from "./demo/demoSteps";
import toast, { Toaster } from "react-hot-toast";


import {
  fetchChapter,
  BIBLE_META,
  findBookMetadata,
  fetchVersesByReferences,
  normalizeTeluguReference,
  searchTeluguKeywordSupabase,
  searchEnglishKeyword,
  groupVersesByTestamentAndBook, GroupedVerses
} from "./services/bibleService";

import { Verse, VerseReference, FullVerse, ParsedReference } from ".";
import { LanguageProvider } from "./context/LanguageContext";
import ProfileMenu from "./components/ProfileMenu";
import { useAuth } from "./context/AuthContext";
import { useReaderSettings } from "./hooks/useReaderSettings.ts";

export const AVAILABLE_VERSIONS = [
  "TELUGU_COMMUNITY_V1",
  "ESV",
  "NIV",
  "NKJV",
  "KJV",
  "GNB",
  "ARAMAIC_PLAIN_EN",
  "NLT",
  "NASB",
] as const;

export const ORIGINAL_VERSIONS = {
  HEBREW_OT: "Hebrew Bible (Original)",
  GREEK_NT: "Greek New Testament (Original)",
} as const;

export type OriginalVersion = keyof typeof ORIGINAL_VERSIONS;
export type AnyVersion =
  | (typeof AVAILABLE_VERSIONS)[number]
  | OriginalVersion;

const App: React.FC = () => {
  const { user, loading } = useAuth();
  type SearchFilters = {
    testament?: "OLD" | "NEW";
    books?: string[];           // multiple selection
    chapterFrom?: number;
    chapterTo?: number;
  };
  
  const [isHomePage, setIsHomePage] = useState(true);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [chatInitialMessage, setChatInitialMessage] = useState<string | null>(null);
  const [chatInitialLanguage, setChatInitialLanguage] = useState<"EN" | "TE" | null>(null);
  const [demoTriggerHighlight, setDemoTriggerHighlight] = useState(false);

  // Core state
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoadingVerses, setIsLoadingVerses] = useState(true);
  const [verseError, setVerseError] = useState<string | null>(null);

  const [selectedBook, setSelectedBook] = useLocalStorage("selectedBook", "");
  const [selectedChapter, setSelectedChapter] = useLocalStorage("selectedChapter", 0);  
  const [selectedVerseRef, setSelectedVerseRef] = useState<VerseReference | null>(null);
  const [selectedVerse, setSelectedVerse] = useLocalStorage("selectedVerse", 1);

  const {
    settings: readerSettingsRaw,
    setSettings: setReaderSettings,
  } = useReaderSettings();
  
  const readerSettings = readerSettingsRaw ?? {
    fontSize: "md",
    autoScrollSpeed: 1,
    autoScrollIntervalMs: 60,
    themeMode: "system",
  };
  
  useThemeMode(readerSettings.themeMode);





  // Study mode & versions
  const [studyMode, setStudyMode] = useLocalStorage<"single" | "parallel">("studyMode", "single");
  const [singleVersion, setSingleVersion] = useLocalStorage("singleVersion", "KJV");
// default Telugu
  // default left version (can be Telugu or English)
  const [leftVersion, setLeftVersion] = useLocalStorage(
    "leftVersion",
    "ESV"
  );
  
  const [rightVersion, setRightVersion] = useLocalStorage(
    "rightVersion",
    "TELUGU_COMMUNITY_V1"
  );
  

  useEffect(() => {
    if (studyMode === "parallel") {
      setLeftVersion("ESV");
      setRightVersion("TELUGU_COMMUNITY_V1");
    }
  }, [studyMode]);
  


  const activeSingleVersion =
  studyMode === "single" ? singleVersion : null;


  const [showWelcome, setShowWelcome] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchView, setIsSearchView] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rawSearchResults, setRawSearchResults] = useState<FullVerse[]>([]);
  const [groupedSearchResults, setGroupedSearchResults] =
    useState<GroupedVerses | null>(null);
    const [lastSearchQuery, setLastSearchQuery] = useState("");

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [notesOpen, setNotesOpen] = useState(false);
  const [incomingVerse, setIncomingVerse] = useState<{
    ref: {
      book: string;
      displayBook: string;
      chapter: number;
      verseStart: number;
      verseEnd?: number;
    };
    text: string;
  } | null>(null);
  
  const verseToolsLanguage =
  studyMode === "single" && singleVersion === "TELUGU_COMMUNITY_V1"
    ? "TE"
    : "EN";


  // UI
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
// Demo Tour State
const [isDemoOpen, setIsDemoOpen] = useState(false);
const [demoStepIndex, setDemoStepIndex] = useState(0);
const [demoTriggerShare, setDemoTriggerShare] = useState(false);
const [demoBehindModal, setDemoBehindModal] = useState(false);


// CENTRALIZED DEMO CLEANUP
const closeAllDemoPopups = useCallback(() => {

  setIsChatOpen(false);

  setIsToolsModalOpen(false);

  setNotesOpen(false);

  setSearchOpen(false);

  setDemoTriggerShare(false);

}, []);



  const isOriginalVersion = (v?: string) =>
    v === "HEBREW_OT" || v === "GREEK_NT";
  

  // Expandable search (material-like)
  // NOTE: searchOpen controls the expanded state. On mobile we show a fixed overlay when true.
  const [searchOpen, setSearchOpen] = useState(false);
  const desktopSearchRef = React.useRef<HTMLDivElement | null>(null);


  // Highlights
  const { highlights, toggleHighlight } = useHighlights(user?.id, selectedBook, selectedChapter);

  useEffect(() => {
    if (!sessionStorage.getItem("welcomeShown")) {
      setShowWelcome(true);
    }
  }, []);
  const handleVerseChange = useCallback((v: number) => {
    setSelectedVerse(v);
    setSelectedVerseRef({ book: selectedBook, chapter: selectedChapter, verse: v });
    setIsToolsModalOpen(false);
  }, [selectedBook, selectedChapter]);

  const handleHighlightVerse = useCallback(
    (verseNum: number, color: string | null) => {
  
      if (!user && !demoTriggerHighlight) {
        toast.error("Please sign in to highlight verses");
        return;
      }
      toggleHighlight(verseNum, color);
  
    },  
    [user, toggleHighlight]
  );
  

  const handleWelcomeDismiss = () => {
    setShowWelcome(false);
    sessionStorage.setItem("welcomeShown", "true");
  };

  // URL hash sync (OAuth-safe)
  const suppressHash = React.useRef(false);

  useEffect(() => {
    if (isSearchView || isLoadingVerses) return;
  
    const current = window.location.hash;
  
    // CRITICAL FIX: do NOT auto-set hash if homepage
    if (!current || current === "#") return;
  
    if (
      current.startsWith("#access_token") ||
      current.includes("access_token=") ||
      current.includes("refresh_token=")
    ) {
      return;
    }
  
    let hash = `#/${encodeURIComponent(selectedBook)}/${selectedChapter}`;
  
    if (
      selectedVerseRef &&
      selectedVerseRef.book === selectedBook &&
      selectedVerseRef.chapter === selectedChapter
    ) {
      hash += `/${selectedVerseRef.verse}`;
    }
  
    if (hash !== current) {
      suppressHash.current = true;
      window.location.hash = hash;
    }
  
  }, [
    isSearchView,
    isLoadingVerses,
    selectedBook,
    selectedChapter,
    selectedVerseRef,
  ]);

  useEffect(() => {
    const parseHash = (hash: string) => {
      if (
        hash.startsWith("#access_token") ||
        hash.includes("access_token=") ||
        hash.includes("refresh_token=")
      ) {
        return;
      }

      setIsSearchView(false);

      const parts = hash.replace(/^#\/?/, "").split("/");
      if (parts.length < 2 || !parts[0]) return;

      const bookCandidate = decodeURIComponent(parts[0].replace(/\+/g, " "));
      const chap = parseInt(parts[1], 10);
      const verse = parts[2] ? parseInt(parts[2], 10) : null;

      const meta = findBookMetadata(bookCandidate);
      if (!meta) return;

      setSelectedBook(meta.name);
      setSelectedChapter(chap);

      if (verse) {
        // Restore selection but DO NOT auto-open tools on reload
        setSelectedVerseRef({ book: meta.name, chapter: chap, verse });
        setSelectedVerse(verse);
        setIsToolsModalOpen(false);
      } else {
        setSelectedVerseRef(null);
        setSelectedVerse(1);
        setIsToolsModalOpen(false);
      }
      
    };
    // Desktop-only: close search on click outside


    const handleHashChange = () => {
      if (suppressHash.current) {
        suppressHash.current = false;
        return;
      }
      parseHash(window.location.hash);
    };

    if (window.location.hash) parseHash(window.location.hash);

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Load verses

  useEffect(() => {

    const handler = (e: any) => {
      setDemoBehindModal(e.detail === true);
    };
  
    window.addEventListener("demo-behind-modal", handler);
  
    return () => window.removeEventListener("demo-behind-modal", handler);
  
  }, []);
  
  useEffect(() => {
    if (isSearchView || !selectedBook || !selectedChapter) return;
    const load = async () => {
      setIsLoadingVerses(true);
      setVerseError(null);
  
      try {
        if (studyMode === "single") {
          const data = await fetchChapter(
            selectedBook,
            selectedChapter,
            singleVersion
          );
          setVerses(data);
        } else {
          const [left, right] = await Promise.all([
            fetchChapter(selectedBook, selectedChapter, leftVersion),
            fetchChapter(selectedBook, selectedChapter, rightVersion),
          ]);
  
          const merged = mergeParallelVerses(
            left,
            right,
            leftVersion,
            rightVersion
          );
  
          setVerses(merged);
        }
      } catch (e) {
        console.error(e);
        setVerseError("Failed to load chapter.");
        setVerses([]);
      } finally {
        setIsLoadingVerses(false);
      }
    };
  
    load();
  }, [
    selectedBook,
    selectedChapter,
    studyMode,
    singleVersion,
    leftVersion,
    rightVersion,
    isSearchView,
  ]);
  
  useEffect(() => {

    const isHome =
      !window.location.hash ||
      window.location.hash === "#" ||
      window.location.hash === "#/";
  
    let title;
    let description;
  
    if (isHome) {
  
      title = "Bible Companion – Free Bible Study App";
  
      description =
        "Bible Companion is a free Bible study app to read scripture, explore verses, and study the Bible online.";
  
    } else {
  
      title = `${selectedBook} ${selectedChapter} – Bible Companion`;
  
      description =
        `Read ${selectedBook} chapter ${selectedChapter} in Bible Companion. Free Bible study tool.`;
  
    }
  
    document.title = title;
  
    let meta = document.querySelector("meta[name='description']");
  
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
  
    meta.setAttribute("content", description);
  
  }, [selectedBook, selectedChapter]);

  useEffect(() => {

    const scriptId = "structured-data-script";
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();
  
    const isHome =
      !window.location.hash ||
      window.location.hash === "#" ||
      window.location.hash === "#/";
  
    const script = document.createElement("script");
    script.id = scriptId;
    script.type = "application/ld+json";
  
    script.text = JSON.stringify({
  
      "@context": "https://schema.org",
  
      "@type": isHome ? "WebSite" : "WebPage",
  
      "name": isHome
        ? "Bible Companion"
        : `${selectedBook} ${selectedChapter} | Bible Companion`,
  
      "url": isHome
        ? "https://biblecompanions.in"
        : `https://biblecompanions.in/#/${selectedBook}/${selectedChapter}`,
  
      "description": isHome
        ? "Free Bible study application."
        : `Read ${selectedBook} chapter ${selectedChapter}.`
  
    });
  
    document.head.appendChild(script);
  
  }, [selectedBook, selectedChapter]);
  useEffect(() => {

    const checkHome = () => {
  
      const hash = window.location.hash;
  
      if (!hash || hash === "#" || hash === "#/") {
        setIsHomePage(true);
      } else {
        setIsHomePage(false);
      }
  
    };
  
    checkHome();
  
    window.addEventListener("hashchange", checkHome);
  
    return () => window.removeEventListener("hashchange", checkHome);
  
  }, []);
  
  // Navigation helpers
  const handleBookChange = useCallback((book: string) => {
    setSelectedBook(book);
    setSelectedChapter(1);
  
    setSelectedVerse(1);
    setSelectedVerseRef(null);
  
    setIsToolsModalOpen(false);
  }, [setSelectedBook, setSelectedChapter, setSelectedVerse]);
  
  const handleChapterChange = useCallback((ch: number) => {
    setSelectedChapter(ch);
  
    setSelectedVerse(1);
    setSelectedVerseRef(null);
  
    setIsToolsModalOpen(false);
  }, [setSelectedChapter, setSelectedVerse]);
  
  const handleStartReading = () => {

    window.location.hash = "#/Genesis/1";
  
    setIsHomePage(false);
  
  };

  const handleGoHome = useCallback(() => {

    setIsDemoOpen(false);
  
    setIsChatOpen(false);
    setIsToolsModalOpen(false);
    setNotesOpen(false);
    setSearchOpen(false);
  
    setSelectedVerseRef(null);
  
    // OPTIONAL but recommended
    setIsSearchView(false);
  
    window.location.hash = "";
  
  }, []);
  
  
  
  const handleStartDemo = () => {

    closeAllDemoPopups();
  
    setStudyMode("single");
  
    navigateTo("Genesis", 1);
  
    setDemoStepIndex(0);
  
    setIsDemoOpen(true);
  
  };
  
  
  
  const handleNextDemoStep = () => {

    closeAllDemoPopups();
  
    const next = demoStepIndex + 1;
  
    if (next >= DEMO_STEPS.length) {
  
      setIsDemoOpen(false);
  
      setStudyMode("single");
  
      navigateTo("Genesis", 1);
  
      localStorage.setItem("demo_completed", "true");
  
      return;
    }
  
    setDemoStepIndex(next);
  
  };
  
  
  const handleSkipDemo = () => {

    closeAllDemoPopups();
  
    setIsDemoOpen(false);
  
    setStudyMode("single");
  
    navigateTo("Genesis", 1);
  
  };
  
  

  const getEnglishVersionForLogic = () => {
    if (studyMode === "single") {
      return singleVersion === "TELUGU_COMMUNITY_V1"
        ? "ESV"
        : singleVersion;
    }
  
    // Parallel mode: left is always English by design
    return leftVersion === "TELUGU_COMMUNITY_V1"
      ? rightVersion
      : leftVersion;
  };
  
  
  const englishVersionForLogic = getEnglishVersionForLogic();
  

  const handleNextChapter = useCallback(() => {
    const meta = BIBLE_META.find((b) => b.name === selectedBook);
    if (!meta) return;
    if (selectedChapter < meta.chapters) {
      handleChapterChange(selectedChapter + 1);
    } else {
      const idx = BIBLE_META.findIndex((b) => b.name === selectedBook);
      if (idx < BIBLE_META.length - 1) {
        handleBookChange(BIBLE_META[idx + 1].name);
      }
    }
  }, [selectedBook, selectedChapter, handleBookChange, handleChapterChange]);

  const handlePreviousChapter = useCallback(() => {
    if (selectedChapter > 1) {
      handleChapterChange(selectedChapter - 1);
    } else {
      const idx = BIBLE_META.findIndex((b) => b.name === selectedBook);
      if (idx > 0) {
        const prev = BIBLE_META[idx - 1];
        setSelectedBook(prev.name);
        setSelectedChapter(prev.chapters);
        setSelectedVerseRef(null);
        setIsToolsModalOpen(false);
      }
    }
  }, [selectedBook, selectedChapter, handleChapterChange]);
  function applySearchFilters(
    verses: FullVerse[],
    filters: SearchFilters
  ): FullVerse[] {
    return verses.filter(v => {
      if (filters.testament) {
        const isOT = BIBLE_META.findIndex(b => b.name === v.book) < 39;
        if (filters.testament === "OLD" && !isOT) return false;
        if (filters.testament === "NEW" && isOT) return false;
      }
  
      if (filters.books && filters.books.length > 0) {
        if (!filters.books.includes(v.book)) return false;
      }
  
      if (
        filters.chapterFrom !== undefined &&
        v.chapter < filters.chapterFrom
      )
        return false;
  
      if (
        filters.chapterTo !== undefined &&
        v.chapter > filters.chapterTo
      )
        return false;
  
      return true;
    });
  }

  function mergeParallelVerses(
    left: Verse[],
    right: Verse[],
    leftVersion: string,
    rightVersion: string
  ): Verse[] {
    const map = new Map<number, Verse>();
  
    left.forEach(v => {
      map.set(v.verse, {
        ...v,
        text: {
          [leftVersion]: v.text[leftVersion],
        },
      });
    });
  
    right.forEach(v => {
      const existing = map.get(v.verse);
      if (!existing) return;
  
      existing.text[rightVersion] = v.text[rightVersion];
    });
  
    return Array.from(map.values()).sort((a, b) => a.verse - b.verse);
  }
  
  

  

  const handleScrollDirectionChange = useCallback((dir: "up" | "down") => {
    setIsNavVisible(dir === "up");
  }, []);

  const handleVerseSelect = useCallback((v: number) => {
    setSelectedVerse(v);
    setSelectedVerseRef({ book: selectedBook, chapter: selectedChapter, verse: v });
    if (window.innerWidth < 768) setIsToolsModalOpen(true);
    setIsChatOpen(false);
  }, [selectedBook, selectedChapter, setSelectedVerse]);
  
  // Search parsing
  const parseReferencesFromString = (refString: string): ParsedReference[] => {
    const parts = refString.split(/\s*[;,]\s*/);
    const parsed: ParsedReference[] = [];
    const regex =
      /^([1-3]?\s*[A-Za-z\u0C00-\u0C7F.'’\-\u00A0]+?)\s+(\d+)\s*:\s*(\d+)(?:-(\d+))?$/u;

    for (const raw of parts) {
      const cleaned = raw.trim();
      if (!cleaned) continue;
      const normalized = normalizeTeluguReference(cleaned);
      const m = normalized.match(regex);
      if (!m) continue;
      const bookCandidate = m[1].trim();
      const chap = parseInt(m[2], 10);
      const startVerse = parseInt(m[3], 10);
      const endVerse = m[4] ? parseInt(m[4], 10) : undefined;
      const meta = findBookMetadata(bookCandidate);
      if (!meta) continue;
      if (chap < 1 || chap > meta.chapters) continue;
      parsed.push({ book: meta.name, chapter: chap, startVerse, endVerse });
    }
    return parsed;
  };

  function recomputeGroupedResults(
    verses: FullVerse[],
    filters: SearchFilters
  ) {
    const filtered = applySearchFilters(verses, filters);
    return groupVersesByTestamentAndBook(filtered);
  }
  

  const handleSearch = async (e?: FormEvent) => {
    e?.preventDefault();
  
    const query = searchQuery.trim();
    if (!query) return;
  
    setSearchError(null);
    setIsSearching(true);
  
    try {
      // 1) Reference search (Psalm 23:1, యోహాను 3:16, etc.)
      const parsedRefs = parseReferencesFromString(
        normalizeTeluguReference(query)
      );
  
      if (parsedRefs.length > 1) {
        const res = await fetchVersesByReferences(parsedRefs);
  
        if (res.length === 0) {
          setSearchError(`No results for "${query}"`);
          setGroupedSearchResults({ oldTestament: {}, newTestament: {} });
        } else {
          setGroupedSearchResults(groupVersesByTestamentAndBook(res));
        }
  
        setIsSearchView(true);
        return;
      }
  
      if (parsedRefs.length === 1) {
        const ref = parsedRefs[0];
        setIsSearchView(false);
        setSelectedBook(ref.book);
        setSelectedChapter(ref.chapter);
        setSelectedVerseRef(
          ref.startVerse
            ? { book: ref.book, chapter: ref.chapter, verse: ref.startVerse }
            : null
        );
        return;
      }
  
      // 2) Keyword search
      const hasTelugu = /[\u0C00-\u0C7F]/.test(query);
      let results: FullVerse[] = [];
  
      // 🔴 HARD GUARD: English keyword + Telugu-only version

      if (hasTelugu) {
        results = await searchTeluguKeywordSupabase(query);
      } else {
        results = await searchEnglishKeyword(query, englishVersionForLogic);
      }
      
  
      if (results.length === 0) {
        setSearchError(`No results for "${query}"`);
        setGroupedSearchResults({ oldTestament: {}, newTestament: {} });
        setIsSearchView(true);
        return;
      }
  
      // 3) Success path
      const initialFilters: SearchFilters = {};
      setRawSearchResults(results);
      setSearchFilters(initialFilters);
      setGroupedSearchResults(
        recomputeGroupedResults(results, initialFilters)
      );
      setLastSearchQuery(query);

      setIsSearchView(true);
    } catch (err) {
      console.error("Search error:", err);
      setSearchError("Search failed.");
      setGroupedSearchResults({ oldTestament: {}, newTestament: {} });
      setIsSearchView(true);
    } finally {
      setIsSearching(false);
      setSearchQuery("");
      setSearchOpen(false);
    }
  };
  
  const resolveChatLanguage = (
    studyMode: "single" | "parallel",
    singleVersion: string
  ): "EN" | "TE" => {
    if (studyMode === "single" && singleVersion === "TELUGU_COMMUNITY_V1") {
      return "TE";
    }
    return "EN";
  };

  const handleClearSearch = () => {
    setIsSearchView(false);
    setGroupedSearchResults({ oldTestament: {}, newTestament: {} });
    setSearchError(null);
  };

  const handleNavigateTo = useCallback((book: string, chapter: number, verse: number) => {
    setIsSearchView(false);
  
    setSelectedBook(book);
    setSelectedChapter(chapter);
  
    setSelectedVerse(verse);
    setSelectedVerseRef({ book, chapter, verse });
  
    setIsToolsModalOpen(false);
    setIsChatOpen(false);
  }, []);
  
  
  const navigateTo = useCallback((
    book: string,
    chap: number,
    verse?: number,
    options?: { openTools?: boolean }
  ) => {
  
    setIsSearchView(false);
    setSearchError(null);
  
    setSelectedBook(book);
    setSelectedChapter(chap);
  
    if (verse !== undefined) {
      setSelectedVerse(verse);
      setSelectedVerseRef({ book, chapter: chap, verse });
    
      if (options?.openTools === true) {
        setIsToolsModalOpen(true);
      }
    }
     else {
      setSelectedVerse(1);
      setSelectedVerseRef(null);
      setIsToolsModalOpen(false);
    }
  }, []);
  

  useEffect(() => {
    const handler = (e: any) => {
      setIncomingVerse(e.detail);
      setNotesOpen(true);
    };
  
    window.addEventListener("open-profile-notes", handler);
    return () => window.removeEventListener("open-profile-notes", handler);
  }, []);


  useEffect(() => {

    if (!isDemoOpen) return;
  
    closeAllDemoPopups();
  

  
    // Ensure homepage exits when demo starts
    if (isHomePage) {
      setIsHomePage(false);
    }
  
    const step = DEMO_STEPS[demoStepIndex];
  

    switch (step.index) {

      case 1:
        navigateTo("John", 3, 16, { openTools: false });
        break;
    
      case 2:
        setStudyMode("parallel");
        navigateTo("John", 3, 16, { openTools: false });
        break;
    
      case 3:
        setStudyMode("single");
        navigateTo("John", 3, 16, { openTools: false });
        setIsChatOpen(true);
        setChatInitialMessage("Explain John 3:16");
        break;
    
        case 4:
          navigateTo("John", 3, 16, { openTools: true });
        
          setTimeout(() => {
            setDemoTriggerHighlight(true);
        
            setTimeout(() => {
              setDemoTriggerHighlight(false);
            }, 800);
        
          }, 500);
        
          break;
        
    
        case 5:
          navigateTo("John", 3, 16, { openTools: true });
        
          setTimeout(() => {
            setDemoTriggerShare(true);
        
            // auto reset so it doesn't retrigger
            setTimeout(() => {
              setDemoTriggerShare(false);
            }, 1000);
        
          }, 600);
        
          break;
        
    
      case 6:
        navigateTo("John", 3, 16, { openTools: false });
        window.dispatchEvent(new CustomEvent("open-profile-notes", {
          detail: {
            ref: {
              book: "John",
              displayBook: "John",
              chapter: 3,
              verseStart: 16,
            },
            text: "For God so loved the world...",
          },
        }));
        break;
    
      case 7:
        setSearchOpen(true);
        break;
    
    }
  }, [
    demoStepIndex,
    isDemoOpen,
    navigateTo,
    setStudyMode,
    closeAllDemoPopups,
  ]);
  


  // Desktop-only: close search on click outside
useEffect(() => {
  if (!searchOpen) return;

  const handleClick = (e: MouseEvent) => {
    if (window.innerWidth < 768) return; // desktop only

    const target = e.target as HTMLElement;
    if (desktopSearchRef.current && !desktopSearchRef.current.contains(target)) {
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  document.addEventListener("mousedown", handleClick);
  return () => document.removeEventListener("mousedown", handleClick);
}, [searchOpen]);


  // Meta
  const selectedBookMeta = BIBLE_META.find((b) => b.name === selectedBook);
  const chapterCount = selectedBookMeta?.chapters ?? 0;

  const selectedVerseData = selectedVerseRef && verses.find((v) => v.verse === selectedVerseRef.verse);

  const isFirstChapter = selectedBook === "Genesis" && selectedChapter === 1;
  const isLastChapter = selectedBook === "Revelation" && selectedChapter === 22;
  
  // Render
  return (
<LanguageProvider>

<Toaster
  position="bottom-center"
  toastOptions={{
    duration: 3000,
    style: {
      background: "#0f172a",
      color: "#fff",
      borderRadius: "10px",
      padding: "12px 16px",
      fontSize: "14px",
    },
  }}
/>
      {loading ? (
        <div className="flex items-center justify-center h-screen text-gray-700 dark:text-gray-300">Loading...</div>
      ) : (
        <div className="flex flex-col h-screen">


{showWelcome && (
  <WelcomeScreen
    onDismiss={handleWelcomeDismiss}
    onExplainVerse={({ book, chapter, verse, language }) => {
      handleWelcomeDismiss();

      // ✅ Navigate to verse + select it
      setIsSearchView(false);
      setSelectedBook(book);
      setSelectedChapter(chapter);
      setSelectedVerseRef({ book, chapter, verse });

      // ✅ Open chatbot
      setIsChatOpen(true);

      // ✅ Auto-send question
      const msg =
        language === "TE"
          ? `${book} ${chapter}:${verse} ఈ వాక్యాన్ని వివరించండి.`
          : `Explain ${book} ${chapter}:${verse}.`;

      setChatInitialMessage(msg);
        // ✅ store language for chatbot
  setChatInitialLanguage(language);
    }}
  />
)}


          {/* HEADER - unchanged layout; overlay search will cover it on mobile when open */}
          <header className="
  bg-slate-900 dark:bg-slate-950
  px-3 py-2 md:px-4 md:py-3
  shadow-md z-40
  border-b border-white/10
  flex items-center justify-between
">

            {/* Left: Logo + Title (single source of truth) */}
            <button
  onClick={handleGoHome}
  type="button"
  className="
    flex items-center gap-2
    cursor-pointer select-none
    rounded-lg
    px-1 py-1
    transition-all duration-200

    hover:bg-white/5
    active:scale-[0.98]
  "
>
  <div className="w-8 h-8 shrink-0">
    <img
      src="/logo.png"
      alt="Bible Companion Logo"
      className="w-full h-full object-contain"
    />
  </div>

  <div className="flex items-center gap-1 whitespace-nowrap">

    <span className="
      text-base md:text-2xl font-bold text-white leading-none
      hover:text-blue-400 transition-colors
    ">
      Bible Companion
    </span>

    <span className="hidden sm:inline text-xs md:text-sm text-slate-300">
      by Joel Prem
    </span>

  </div>
</button>






            {/* MOBILE title (still shown in mobile header) */}
            {/* <div className="flex md:hidden items-center gap-2 ml-2">
  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
    VerseMind
  </span>
  <span className="text-xs text-gray-600 dark:text-gray-400">
    by Joel Prem
  </span>
</div> */}


            {/* Right: compact search + profile */}
            <div className="flex items-center gap-3 ml-2">
              {/* Expandable Search (Material-style) */}
              <div className="relative">
                {/* Always show the small icon button when search is closed */}
                {!searchOpen && (
                  <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchOpen(true);
                  }}
                  aria-label="Open search"
                  className="
  w-9 h-9 md:w-10 md:h-10
  flex items-center justify-center
  rounded-2xl
  bg-white/10 dark:bg-white/5
  border border-white/10
  text-white
  shadow-sm
  hover:bg-white/15
  hover:border-white/15
  hover:shadow-[0_0_10px_rgba(59,130,246,0.35)]
  transition-all duration-150
"

                >
                
                <i className="fas fa-search text-white/90" />
                  </button>
                )}

                {/* DESKTOP: expanded search inline (keeps old behaviour) */}
                {searchOpen && (
                  <div
                  ref={desktopSearchRef}
                  className="
  hidden md:flex items-center
  bg-white/10 dark:bg-white/5
  border border-white/10
  rounded-full
  shadow-lg
  overflow-hidden
  px-2
  backdrop-blur-xl
"


                >                
                    <form onSubmit={(e) => void handleSearch(e)} className="flex items-center">
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search (Psalm 23:1 | యోహాను 3:16)"
                        className="
  px-3 py-2 w-80 max-w-[420px]
  bg-transparent outline-none text-sm
  text-white/90 placeholder:text-white/50
"

                      />
                      <button
  type="submit"
  aria-label="Search"
  className="
  w-10 h-10 flex items-center justify-center
  rounded-2xl
  bg-gradient-to-r from-blue-600 to-indigo-600
  text-white
  shadow-md
  hover:shadow-[0_0_12px_rgba(59,130,246,0.45)]
  transition-all duration-150
"


>
  <i className="fas fa-arrow-right" />
</button>

                      <button
  type="button"
  onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
  className="
  w-10 h-10 flex items-center justify-center
  rounded-2xl
  bg-white/10 dark:bg-white/5
  border border-white/10
  hover:bg-white/15
  transition-all duration-150
"

>
<i className="fas fa-times text-white/80" />
</button>

                    </form>
                  </div>
                )}

                {/* MOBILE: fixed overlay that covers header/title when search is open */}
                {/* MOBILE SEARCH OVERLAY */}
{searchOpen && (
  <div
    id="mobile-search-overlay"
    className="
      md:hidden 
      fixed inset-0 
      z-[9999] 
      bg-slate-950/90
      backdrop-blur-sm 
      flex items-start
      p-3
    "
    onClick={() => {
      setSearchOpen(false);
      setSearchQuery("");
    }}
  >
    <form
      id="mobile-search-box"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => void handleSearch(e)}
      className="
        w-full 
        flex items-center gap-2 
        bg-white/10
border border-white/10
backdrop-blur-xl

        rounded-full 
        shadow-md 
        p-2
      "
    >
      <input
        autoFocus
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="flex-1 px-3 py-2 bg-transparent outline-none text-sm text-white/90 placeholder:text-white/50"
        placeholder="Search (Psalm 23:1 | యోహాను 3:16)"
      />

      <button
        type="submit"
        className="
  w-10 h-10 flex items-center justify-center rounded-lg 
  bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md
  hover:shadow-[0_0_6px_rgba(59,130,246,0.45)]
  dark:hover:shadow-[0_0_8px_rgba(59,130,246,0.5)]
"

      >
        <i className="fas fa-arrow-right" />
      </button>

      <button
        type="button"
        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
        className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 border border-white/10 text-white/90"
      >
        <i className="fas fa-times text-gray-700 dark:text-gray-300" />
      </button>
    </form>
  </div>
)}

              </div>

              {/* Profile menu */}
              <div className="ml-2">
              <ProfileMenu
  readerSettings={readerSettings}
  setReaderSettings={(next) => setReaderSettings(next)}
  onGoHome={handleGoHome}
/>



              </div>
            </div>
          </header>

          {/* MAIN */}
          <main className="flex-1 flex flex-col md:flex-row overflow-x-hidden bg-slate-50 dark:bg-[#0B0F14] min-h-0">



{/* SEO CONTENT BLOCK — Google reads this */}
<section className="sr-only">

  {isHomePage ? (
    <>
      <h1>Bible Companion – Free Bible Study App</h1>

      <p>
        Read and study the Holy Bible online. Access Genesis, Psalms,
        Matthew, John, Revelation, and more.
      </p>

      <p>
        Bible Companion provides fast search, multiple versions,
        verse highlighting, and powerful Bible study tools.
      </p>
    </>
  ) : (
    <>
      <h1>
        {selectedBook} Chapter {selectedChapter} – Bible Companion
      </h1>

      <p>
        Read {selectedBook} chapter {selectedChapter} online in Bible Companion.
      </p>
    </>
  )}

</section>
{isHomePage ? (

<div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-10 relative">


{/* Background glow */}
<div className="absolute inset-0 pointer-events-none">
  <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full"></div>
</div>

{/* Logo */}
<div className="relative">
  <img
    src="/logo.png"
    className="w-20 h-20 mb-6 drop-shadow-lg"
    alt="Bible Companion"
  />
</div>

{/* Headline */}
<h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-white">
  Study the Bible with
  <span className="block text-blue-600 dark:text-blue-400">
    Intelligence & Clarity
  </span>
</h1>

{/* Subtext */}
<p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-xl">
  Read in Telugu & English, get AI explanations, highlight verses,
  create shareable verse images, and deepen your understanding.
</p>

{/* CTA buttons */}
<div className="flex flex-col sm:flex-row gap-4 mb-10">

  <button
    onClick={handleStartReading}
    className="
      px-8 py-4
      bg-gradient-to-r from-blue-600 to-indigo-600
      text-white
      rounded-xl
      text-lg
      font-semibold
      shadow-lg
      hover:shadow-blue-500/40
      hover:scale-[1.03]
      transition-all duration-200
    "
  >
    Start Reading
  </button>

  <button
    onClick={handleStartDemo}
    className="
      px-8 py-4
      bg-white/70 dark:bg-slate-800/70
      backdrop-blur-xl
      border border-slate-300 dark:border-white/10
      text-slate-800 dark:text-white
      rounded-xl
      text-lg
      font-semibold
      hover:bg-white dark:hover:bg-slate-800
      hover:scale-[1.03]
      transition-all duration-200
      flex items-center gap-2 justify-center
    "
  >
    <i className="fas fa-play-circle text-blue-500"></i>
    Interactive Demo
  </button>

</div>

{/* Feature highlights */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl text-sm">

  {/* Box 1 */}
  <div className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-700
    rounded-xl p-4
    shadow-sm
    hover:shadow-md
    hover:scale-[1.02]
    transition-all duration-200
  ">
    <div className="font-semibold text-slate-900 dark:text-white">
      AI Explanation
    </div>
    <div className="text-slate-600 dark:text-slate-400 text-xs mt-1">
      Understand instantly
    </div>
  </div>

  {/* Box 2 */}
  <div className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-700
    rounded-xl p-4
    shadow-sm
    hover:shadow-md
    hover:scale-[1.02]
    transition-all duration-200
  ">
    <div className="font-semibold text-slate-900 dark:text-white">
      Telugu + English
    </div>
    <div className="text-slate-600 dark:text-slate-400 text-xs mt-1">
      Side-by-side study
    </div>
  </div>

  {/* Box 3 */}
  <div className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-700
    rounded-xl p-4
    shadow-sm
    hover:shadow-md
    hover:scale-[1.02]
    transition-all duration-200
  ">
    <div className="font-semibold text-slate-900 dark:text-white">
      Share Verse Images
    </div>
    <div className="text-slate-600 dark:text-slate-400 text-xs mt-1">
      Beautiful & ready
    </div>
  </div>

  {/* Box 4 */}
  <div className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-700
    rounded-xl p-4
    shadow-sm
    hover:shadow-md
    hover:scale-[1.02]
    transition-all duration-200
  ">
    <div className="font-semibold text-slate-900 dark:text-white">
      Smart Search
    </div>
    <div className="text-slate-600 dark:text-slate-400 text-xs mt-1">
      Find anything fast
    </div>
  </div>

</div>


</div>


) : isSearchView ? (
              <SearchResultDisplay
              groupedResults={groupedSearchResults ?? { oldTestament: {}, newTestament: {} }}
              isLoading={isSearching}
              error={searchError}
              onClear={handleClearSearch}
              searchQuery={lastSearchQuery} 
              studyMode={studyMode}
              onOpenFilters={() => setFiltersOpen(true)}  
              englishVersion={englishVersionForLogic}
              onNavigate={navigateTo}
            />
            
            
            ) : (
              <>
                {/* LEFT: Navigation (fixed/sticky) + Scripture (scrollable) */}
                <div className="w-full md:w-2/3 flex flex-col flex-1 min-h-0">
                  {/* NavigationPane remains visible (sticky) and outside the scripture scroll area */}
                  <div className="mt-0">
                  <NavigationPane
  selectedBook={selectedBook}
  selectedChapter={selectedChapter}
  selectedVerse={selectedVerse}
  onNavigateTo={handleNavigateTo}

  onNextChapter={handleNextChapter}
  onPreviousChapter={handlePreviousChapter}
  isFirstChapterOfBible={isFirstChapter}
  isLastChapterOfBible={isLastChapter}

  studyMode={studyMode}
  singleVersion={singleVersion}
  leftVersion={leftVersion}
  rightVersion={rightVersion}
  onSetStudyMode={setStudyMode}
  onSetSingleVersion={setSingleVersion}
  onSetLeftVersion={setLeftVersion}
  onSetRightVersion={setRightVersion}
  versions={[...AVAILABLE_VERSIONS]}
/>


                  </div>

                  {/* ScriptureDisplay should be the only scrollable area inside the left column */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ScriptureDisplay
                      bookName={selectedBook}
                      chapterNum={selectedChapter}
                      verses={verses}
                      isLoading={isLoadingVerses}
                      error={verseError}
                      englishVersion={singleVersion}
                      studyMode={studyMode}
                      leftVersion={leftVersion}
                      rightVersion={rightVersion}
                      onVerseSelect={handleVerseSelect}
                      selectedVerseRef={selectedVerseRef}
                      onNextChapter={handleNextChapter}
                      onPreviousChapter={handlePreviousChapter}
                      onScrollDirectionChange={handleScrollDirectionChange}
                      highlights={highlights}
                      readerSettings={readerSettings}
                      onHighlightVerse={handleHighlightVerse}
                    />
                  </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="
  w-full md:w-1/3 hidden md:block
  bg-white dark:bg-slate-900
  border-l border-slate-200 dark:border-white/10
  overflow-y-auto
">

                  {selectedVerseRef && selectedVerseData ? (
                    <VerseTools
                    demoTriggerHighlight={demoTriggerHighlight}
                    demoTriggerShare={demoTriggerShare}
                    verseRef={selectedVerseRef}
                    verseData={selectedVerseData}
                    uiLanguage={verseToolsLanguage}
                    bibleVersion={
                      verseToolsLanguage === "TE"
                        ? "TELUGU_COMMUNITY_V1"
                        : englishVersionForLogic
                    }
                      currentHighlight={highlights[selectedVerseRef.verse] || null}
                      onHighlightChange={(color) => {

                        // Ignore demo trigger
                        if (!user && !demoTriggerHighlight) {
                          toast.error("Please sign in to highlight verses");
                          return;
                        }
                      
                        toggleHighlight(selectedVerseRef.verse, color);
                      
                      }}
                      
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
                      <p>Select a verse to view tools.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>

          {/* Mobile tools modal */}
          {isToolsModalOpen && selectedVerseRef && selectedVerseData && (
            <div className="fixed inset-0 z-[1000] md:hidden bg-black/60" onClick={() => setIsToolsModalOpen(false)}>
              <div className="fixed bottom-0 left-0 right-0 h-[85vh] bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
                <VerseTools
                  demoTriggerHighlight={demoTriggerHighlight}
                  demoTriggerShare={demoTriggerShare}
                  verseRef={selectedVerseRef}
                  verseData={selectedVerseData}
                  uiLanguage={verseToolsLanguage}
                  bibleVersion={
                    verseToolsLanguage === "TE"
                      ? "TELUGU_COMMUNITY_V1"
                      : englishVersionForLogic
                  }
                  currentHighlight={highlights[selectedVerseRef.verse] || null}
                  onHighlightChange={(color) => {

                    // Ignore demo trigger
                    if (!user && !demoTriggerHighlight) {
                      toast.error("Please sign in to highlight verses");
                      return;
                    }
                  
                    toggleHighlight(selectedVerseRef.verse, color);
                  
                  }}
                  
                  onClose={() => setIsToolsModalOpen(false)}
                />
              </div>
            </div>
          )}
          {notesOpen && user && (
  <ProfileNotes
    userId={user.id}
    incomingVerse={incomingVerse ?? undefined}
    onClose={() => {
      setNotesOpen(false);
      setIncomingVerse(null);
    }}
  />
)}
          {filtersOpen && (
  <div
    className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center"
    onClick={() => setFiltersOpen(false)}
  >
    <div
      className="bg-white dark:bg-gray-900 rounded-xl p-6 w-[90%] max-w-md"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-xl font-bold mb-4">Filter Search Results</h2>

{/* Testament filter */}
<div className="mb-4">
  <label className="block text-sm mb-1">Testament</label>
  <select
    value={searchFilters.testament ?? ""}
    onChange={(e) =>
      setSearchFilters(f => ({
        ...f,
        testament: e.target.value
          ? (e.target.value as "OLD" | "NEW")
          : undefined,
      }))
    }
    className="w-full p-2 rounded border dark:bg-gray-800"
  >
    <option value="">All</option>
    <option value="OLD">Old Testament</option>
    <option value="NEW">New Testament</option>
  </select>
</div>

{/* Multi-book selection */}
<div className="mb-4">
  <label className="block text-sm mb-2">Books</label>
  <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1 dark:bg-gray-800">
    {BIBLE_META.map(b => {
      const checked = searchFilters.books?.includes(b.name) ?? false;
      return (
        <label key={b.name} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) =>
              setSearchFilters(f => {
                const set = new Set(f.books ?? []);
                e.target.checked ? set.add(b.name) : set.delete(b.name);
                return { ...f, books: [...set] };
              })
            }
          />
          {b.name}
        </label>
      );
    })}
  </div>
</div>

{/* Chapter range */}
<div className="flex gap-3 mb-4">
  <div className="flex-1">
    <label className="block text-sm mb-1">From Chapter</label>
    <input
      type="number"
      value={searchFilters.chapterFrom ?? ""}
      onChange={(e) =>
        setSearchFilters(f => ({
          ...f,
          chapterFrom: e.target.value ? Number(e.target.value) : undefined,
        }))
      }
      className="w-full p-2 rounded border dark:bg-gray-800"
    />
  </div>

  <div className="flex-1">
    <label className="block text-sm mb-1">To Chapter</label>
    <input
      type="number"
      value={searchFilters.chapterTo ?? ""}
      onChange={(e) =>
        setSearchFilters(f => ({
          ...f,
          chapterTo: e.target.value ? Number(e.target.value) : undefined,
        }))
      }
      className="w-full p-2 rounded border dark:bg-gray-800"
    />
  </div>
</div>


      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => {
            const clearedFilters: SearchFilters = {};

setSearchFilters(clearedFilters);
setGroupedSearchResults(
  recomputeGroupedResults(rawSearchResults, {})
);


            setFiltersOpen(false);

          }}
          className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-700"
        >
          Clear
        </button>

        <button
  onClick={() => {
    const currentFilters = { ...searchFilters };

    setGroupedSearchResults(
      recomputeGroupedResults(rawSearchResults, currentFilters)
    );
    
    setFiltersOpen(false);
  }}
  className="px-4 py-2 rounded bg-blue-600 text-white"
>
  Apply
</button>

      </div>
    </div>
  </div>
)}




<footer className="
  bg-slate-100 dark:bg-slate-950
  text-center p-2 text-xs
  text-slate-600 dark:text-slate-400
  border-t border-slate-200 dark:border-white/10
">
  <div className="sr-only">
  <a href="/#/Genesis/1">Genesis 1</a>
  <a href="/#/John/3">John 3</a>
  <a href="/#/Psalm/23">Psalm 23</a>
  <a href="/#/Matthew/5">Matthew 5</a>
</div>

© 2026 Bible Companion
          </footer>

          {isDemoOpen && (
            <DemoTourOverlay
  step={DEMO_STEPS[demoStepIndex]}
  totalSteps={DEMO_STEPS.length}
  onNext={handleNextDemoStep}
  onSkip={handleSkipDemo}
  behindModal={demoBehindModal}
/>

)}


          <Chatbot
  selectedBook={selectedBook}
  selectedChapter={selectedChapter}
  selectedVerseRef={selectedVerseRef}
  verses={verses}
  studyMode={studyMode}
  singleVersion={singleVersion}
  isOpen={isChatOpen}
  onToggle={() => setIsChatOpen(!isChatOpen)}
  initialMessage={chatInitialMessage}
  initialLanguage={chatInitialLanguage}
  onInitialMessageConsumed={() => {
        setChatInitialMessage(null);
      }}
/>



        </div>
      )}
    </LanguageProvider>
  );
};

export default App;