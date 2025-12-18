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

import {
  fetchChapter,
  BIBLE_META,
  findBookMetadata,
  fetchVersesByReferences,
  normalizeTeluguReference,
  searchTeluguKeyword,
  searchEnglishKeyword,
  groupVersesByTestamentAndBook, GroupedVerses
} from "./services/bibleService";

import { Verse, VerseReference, FullVerse, ParsedReference } from ".";
import { LanguageProvider } from "./context/LanguageContext";
import ProfileMenu from "./components/ProfileMenu";
import { useAuth } from "./context/AuthContext";

const AVAILABLE_VERSIONS = ["BSI_TELUGU", "ESV", "NIV", "KJV", "NKJV"];

const App: React.FC = () => {
  const { user, loading } = useAuth();
  type SearchFilters = {
    testament?: "OLD" | "NEW";
    books?: string[];           // multiple selection
    chapterFrom?: number;
    chapterTo?: number;
  };
  
  
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  
  // Core state
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoadingVerses, setIsLoadingVerses] = useState(true);
  const [verseError, setVerseError] = useState<string | null>(null);

  const [selectedBook, setSelectedBook] = useLocalStorage("selectedBook", "Genesis");
  const [selectedChapter, setSelectedChapter] = useLocalStorage("selectedChapter", 1);
  const [selectedVerseRef, setSelectedVerseRef] = useState<VerseReference | null>(null);

  // Study mode & versions
  const [studyMode, setStudyMode] = useLocalStorage<"single" | "parallel">("studyMode", "single");
  const [singleVersion, setSingleVersion] = useLocalStorage("singleVersion", "KJV");
// default Telugu
  const [leftVersion, setLeftVersion] = useLocalStorage("leftVersion", "BSI_TELUGU");
  const [rightVersion, setRightVersion] = useLocalStorage("rightVersion", "ESV");

  const activeEnglishVersion = studyMode === "single" ? singleVersion : rightVersion;

  const [showWelcome, setShowWelcome] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchView, setIsSearchView] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rawSearchResults, setRawSearchResults] = useState<FullVerse[]>([]);
  const [groupedSearchResults, setGroupedSearchResults] =
    useState<GroupedVerses | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [notesOpen, setNotesOpen] = useState(false);
const [incomingVerse, setIncomingVerse] = useState<{
  ref: { book: string; chapter: number; verse: number };
  text: string;
} | null>(null);


  // UI
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);

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

  const handleWelcomeDismiss = () => {
    setShowWelcome(false);
    sessionStorage.setItem("welcomeShown", "true");
  };

  // URL hash sync (OAuth-safe)
  const suppressHash = React.useRef(false);

  useEffect(() => {
    if (isSearchView || isLoadingVerses) return;

    const current = window.location.hash;

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
  }, [isSearchView, isLoadingVerses, selectedBook, selectedChapter, selectedVerseRef]);

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
        setIsToolsModalOpen(false);
      } else {
        setSelectedVerseRef(null);
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
    if (isSearchView) return;

    const load = async () => {
      setIsLoadingVerses(true);
      setVerseError(null);

      try {
        const data = await fetchChapter(selectedBook, selectedChapter);
        setVerses(data);
      } catch (e) {
        console.error(e);
        setVerseError("Failed to load chapter.");
        setVerses([]);
      } finally {
        setIsLoadingVerses(false);
      }
    };

    load();
  }, [selectedBook, selectedChapter, isSearchView]);
  
  // Navigation helpers
  const handleBookChange = useCallback((book: string) => {
    setSelectedBook(book);
    setSelectedChapter(1);
    setSelectedVerseRef(null);
    setIsToolsModalOpen(false);
  }, []);

  const handleChapterChange = useCallback((ch: number) => {
    setSelectedChapter(ch);
    setSelectedVerseRef(null);
    setIsToolsModalOpen(false);
  }, []);

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
  
  

  const handleScrollDirectionChange = useCallback((dir: "up" | "down") => {
    setIsNavVisible(dir === "up");
  }, []);

  const handleVerseSelect = useCallback((v: number) => {
    setSelectedVerseRef({ book: selectedBook, chapter: selectedChapter, verse: v });
    if (window.innerWidth < 768) setIsToolsModalOpen(true);
    setIsChatOpen(false);
  }, [selectedBook, selectedChapter]);

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
  
    // 1) Try parsing as reference (Telugu/English)
    const parsedRefs = parseReferencesFromString(normalizeTeluguReference(query));
  
    if (parsedRefs.length > 1) {
      setIsSearching(true);
      try {
        const res = await fetchVersesByReferences(parsedRefs);
    
        if (res.length === 0) {
          setSearchError(`No results for "${query}"`);
          setGroupedSearchResults({ oldTestament: {}, newTestament: {} });
        } else {
          const grouped = groupVersesByTestamentAndBook(res);
          setGroupedSearchResults(grouped);
        }
    
        setIsSearchView(true);
      } catch (e) {
        console.error(e);
        setSearchError("Failed to fetch results.");
        setGroupedSearchResults({ oldTestament: {}, newTestament: {} });
      } finally {
        setIsSearching(false);
        setSearchQuery("");
        setSearchOpen(false);
      }
      return;
    }
    
  
    if (parsedRefs.length === 1) {
      const ref = parsedRefs[0];
      setIsSearchView(false);
      setSelectedBook(ref.book);
      setSelectedChapter(ref.chapter);
      if (ref.startVerse) {
        setSelectedVerseRef({ book: ref.book, chapter: ref.chapter, verse: ref.startVerse });
      } else {
        setSelectedVerseRef(null);
      }
      setSearchQuery("");
      setSearchOpen(false);
      return;
    }
  
    // 2) Keyword search — detect Telugu vs English
    const hasTelugu = /[\u0C00-\u0C7F]/.test(query);
    let results: FullVerse[] = [];
  
    setIsSearching(true);
    try {
      if (hasTelugu) {
        // Telugu local search
        results = await searchTeluguKeyword(query, {
          wholeWord: false,
          requireAll: false,
          highlight: true,
        });
      } else {
        // English search (Supabase) — uses the currently active English version
        results = await searchEnglishKeyword(query, activeEnglishVersion);
      }
  
      if (!results || results.length === 0) {
        setSearchError(`No results for "${query}"`);
        setRawSearchResults([]);
        setGroupedSearchResults({ oldTestament: {}, newTestament: {} });
        return;
      }
       else {
        const initialFilters: SearchFilters = {};

setRawSearchResults(results);
setSearchFilters(initialFilters);

setGroupedSearchResults(
  recomputeGroupedResults(results, initialFilters)
);





      }
  
      setIsSearchView(true);
    } catch (err) {
      console.error("Search error:", err);
      setSearchError("Search failed.");
    } finally {
      setIsSearching(false);
      setSearchQuery("");
      setSearchOpen(false);
    }
  };
  
  

  const handleClearSearch = () => {
    setIsSearchView(false);
    setGroupedSearchResults({ oldTestament: {}, newTestament: {} });
    setSearchError(null);
  };
  
  const navigateTo = useCallback((book: string, chap: number, verse?: number) => {
    setIsSearchView(false);
 

    setSearchError(null);
    setSelectedBook(book);
    setSelectedChapter(chap);
    if (verse !== undefined) {
      setSelectedVerseRef({ book, chapter: chap, verse });
      if (window.innerWidth < 768) setIsToolsModalOpen(true);
    } else {
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
      {loading ? (
        <div className="flex items-center justify-center h-screen text-gray-700 dark:text-gray-300">Loading...</div>
      ) : (
        <div className="flex flex-col h-screen">

          {showWelcome && <WelcomeScreen onDismiss={handleWelcomeDismiss} />}

          {/* HEADER - unchanged layout; overlay search will cover it on mobile when open */}
          <header className="bg-white dark:bg-slate-900 p-3 shadow-md z-40 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            {/* Left: Logo & title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-6 h-6">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M12 8v8" /><path d="M10 10h4" />
                </svg>
              </div>

              <div className="hidden md:flex flex-col leading-tight">
                <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">AI Bible Study Companion</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">by Joel Prem</span>
              </div>
            </div>

            {/* MOBILE title (still shown in mobile header) */}
            <div className="flex md:hidden flex-col leading-tight ml-2">
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">AI Bible Study Companion</span>
            </div>

            {/* Right: compact search + profile */}
            <div className="flex items-center gap-3">
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
  w-10 h-10 flex items-center justify-center rounded-xl 
  bg-gray-50 dark:bg-gray-800 
  border border-gray-200 dark:border-[#2A2F35]
  hover:shadow-[0_0_6px_rgba(59,130,246,0.45)]
  dark:hover:shadow-[0_0_8px_rgba(59,130,246,0.5)]
  transition
"

                  >
                    <i className="fas fa-search text-gray-700 dark:text-gray-300" />
                  </button>
                )}

                {/* DESKTOP: expanded search inline (keeps old behaviour) */}
                {searchOpen && (
                  <div
                  ref={desktopSearchRef}
                  className="hidden md:flex items-center bg-white dark:bg-gray-800 
border border-gray-300 dark:border-[#2A2F35] 
rounded-full shadow-md overflow-hidden px-2"

                >                
                    <form onSubmit={(e) => void handleSearch(e)} className="flex items-center">
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search (Psalm 23:1 | యోహాను 3:16)"
                        className="px-3 py-2 w-80 max-w-[420px] bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100"
                      />
                      <button
  type="submit"
  aria-label="Search"
  className="
  w-10 h-10 flex items-center justify-center rounded-lg 
  bg-blue-600 text-white
  hover:shadow-[0_0_6px_rgba(59,130,246,0.45)]
  dark:hover:shadow-[0_0_8px_rgba(59,130,246,0.5)]
"

>
  <i className="fas fa-arrow-right" />
</button>

                      <button
  type="button"
  onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
  className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700"
>
  <i className="fas fa-times text-gray-700 dark:text-gray-300" />
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
      bg-white/95 dark:bg-gray-900/95 
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
        bg-white dark:bg-gray-800
        border border-gray-300 dark:border-[#2A2F35]
        rounded-full 
        shadow-md 
        p-2
      "
    >
      <input
        autoFocus
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="flex-1 px-3 py-2 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100"
        placeholder="Search (Psalm 23:1 | యోహాను 3:16)"
      />

      <button
        type="submit"
        className="
  w-10 h-10 flex items-center justify-center rounded-lg 
  bg-gray-200 dark:bg-gray-700
  hover:shadow-[0_0_6px_rgba(59,130,246,0.45)]
  dark:hover:shadow-[0_0_8px_rgba(59,130,246,0.5)]
"

      >
        <i className="fas fa-arrow-right" />
      </button>

      <button
        type="button"
        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
        className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700"
      >
        <i className="fas fa-times text-gray-700 dark:text-gray-300" />
      </button>
    </form>
  </div>
)}

              </div>

              {/* Profile menu */}
              <div className="ml-2">
                <ProfileMenu />
              </div>
            </div>
          </header>

          {/* MAIN */}
          <main className="flex-grow flex flex-col md:flex-row overflow-hidden">
            {isSearchView ? (
              <SearchResultDisplay
              groupedResults={groupedSearchResults ?? { oldTestament: {}, newTestament: {} }}
              isLoading={isSearching}
              error={searchError}
              onClear={handleClearSearch}
              onOpenFilters={() => setFiltersOpen(true)}  
              englishVersion={activeEnglishVersion}
              onNavigate={navigateTo}
            />
            
            
            ) : (
              <>
                {/* LEFT: Navigation (fixed/sticky) + Scripture (scrollable) */}
                <div className="w-full md:w-2/3 flex flex-col min-h-0">

                  {/* NavigationPane remains visible (sticky) and outside the scripture scroll area */}
                  <div className="mt-0">
                    <NavigationPane
                      selectedBook={selectedBook}
                      selectedChapter={selectedChapter}
                      onBookChange={handleBookChange}
                      onChapterChange={handleChapterChange}
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

                      versions={AVAILABLE_VERSIONS}
                    />
                  </div>

                  {/* ScriptureDisplay should be the only scrollable area inside the left column */}
                  <div className="flex-grow overflow-y-auto min-h-0">
                    <ScriptureDisplay
                      bookName={selectedBook}
                      chapterNum={selectedChapter}
                      verses={verses}
                      isLoading={isLoadingVerses}
                      error={verseError}
                      englishVersion={activeEnglishVersion}
                      studyMode={studyMode}
                      leftVersion={leftVersion}
                      rightVersion={rightVersion}
                      onVerseSelect={handleVerseSelect}
                      selectedVerseRef={selectedVerseRef}
                      onNextChapter={handleNextChapter}
                      onPreviousChapter={handlePreviousChapter}
                      onScrollDirectionChange={handleScrollDirectionChange}
                      highlights={highlights}
                    />
                  </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="w-full md:w-1/3 hidden md:block bg-white dark:bg-gray-900 border-l border-gray-300 dark:border-[#2A2F35] overflow-y-auto">
                  {selectedVerseRef && selectedVerseData ? (
                    <VerseTools
                      verseRef={selectedVerseRef}
                      verseData={selectedVerseData}
                      englishVersion={activeEnglishVersion}
                      currentHighlight={highlights[selectedVerseRef.verse] || null}
                      onHighlightChange={(color) => {
                        if (!user) {
                          alert("Please sign in to highlight verses.");
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
                  verseRef={selectedVerseRef}
                  verseData={selectedVerseData}
                  englishVersion={activeEnglishVersion}
                  currentHighlight={highlights[selectedVerseRef.verse] || null}
                  onHighlightChange={(color) => {
                    if (!user) {
                      alert("Please sign in to highlight verses.");
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



          <footer className="bg-gray-200 dark:bg-[#111418] text-center p-2 text-xs text-gray-600 dark:text-gray-400">
            Contact: joelpremtej@gmail.com
          </footer>

          <Chatbot
            selectedBook={selectedBook}
            selectedChapter={selectedChapter}
            selectedVerseRef={selectedVerseRef}
            verses={verses}
            englishVersion={activeEnglishVersion}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(!isChatOpen)}
          />
        </div>
      )}
    </LanguageProvider>
  );
};

export default App;
