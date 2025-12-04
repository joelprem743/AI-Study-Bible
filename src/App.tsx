// src/App.tsx
import React, { useState, useEffect, useCallback, FormEvent } from "react";

import NavigationPane from "./components/NavigationPane";
import { ScriptureDisplay } from "./components/ScriptureDisplay";
import { VerseTools } from "./components/VerseTools";
import { Chatbot } from "./components/Chatbot";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { SearchResultDisplay } from "./components/SearchResultDisplay";

import { useLocalStorage } from "./hooks/useLocalStorage";
import { useHighlights } from "./hooks/useHighlights";

import {
  fetchChapter,
  BIBLE_META,
  findBookMetadata,
  fetchVersesByReferences,
  normalizeTeluguReference,
} from "./services/bibleService";

import { searchBibleByKeyword } from "./services/geminiService";

import type { Verse, VerseReference, FullVerse, ParsedReference } from "./types";

import { LanguageProvider } from "./context/LanguageContext";
import ProfileMenu from "./components/ProfileMenu";
import { useAuth } from "./context/AuthContext";

const App: React.FC = () => {
  const { user, loading } = useAuth();

  // ------------------ CORE STATE ------------------
  const [verses, setVerses] = useState<Verse[]>([]);
  const [isLoadingVerses, setIsLoadingVerses] = useState(true);
  const [verseError, setVerseError] = useState<string | null>(null);

  const [selectedBook, setSelectedBook] = useLocalStorage<string>(
    "selectedBook",
    "Genesis"
  );
  const [selectedChapter, setSelectedChapter] = useLocalStorage<number>(
    "selectedChapter",
    1
  );

  const [selectedVerseRef, setSelectedVerseRef] =
    useState<VerseReference | null>(null);
  const [englishVersion, setEnglishVersion] = useLocalStorage<string>(
    "englishVersion",
    "ESV"
  );

  const [showWelcome, setShowWelcome] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);

  const [isSearchView, setIsSearchView] = useState(false);
  const [searchResults, setSearchResults] = useState<FullVerse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);

  // ------------------ HIGHLIGHTS (must be AFTER selectedBook/chapter) ------------------
  const { highlights, toggleHighlight } = useHighlights(
    user?.id,
    selectedBook,
    selectedChapter
  );

  // ------------------ SHOW WELCOME ------------------
  useEffect(() => {
    if (!sessionStorage.getItem("welcomeShown")) {
      setShowWelcome(true);
    }
  }, []);

  const handleWelcomeDismiss = () => {
    setShowWelcome(false);
    sessionStorage.setItem("welcomeShown", "true");
  };

  // ------------------ SYNC URL HASH (OAuth-safe) ------------------
  /**
   * IMPORTANT:
   * Supabase OAuth sends tokens in the URL hash:
   *   #access_token=...&refresh_token=...
   *
   * If we overwrite that hash too early (e.g., with "#/Genesis/1"),
   * Supabase cannot hydrate the session and `user` stays null.
   *
   * So: if the current hash looks like an OAuth callback,
   * we leave it alone and let Supabase process it first.
   */
  useEffect(() => {
    if (isSearchView) return;

    const currentHash = window.location.hash;

    // Detect Supabase OAuth hash and DO NOT touch it
    if (
      currentHash.startsWith("#access_token") ||
      currentHash.includes("access_token=") ||
      currentHash.includes("refresh_token=")
    ) {
      return;
    }

    let desiredHash = `#/${encodeURIComponent(selectedBook)}/${selectedChapter}`;
    if (
      selectedVerseRef &&
      selectedVerseRef.book === selectedBook &&
      selectedVerseRef.chapter === selectedChapter
    ) {
      desiredHash += `/${selectedVerseRef.verse}`;
    }

    if (currentHash !== desiredHash) {
      window.location.hash = desiredHash;
    }
  }, [selectedBook, selectedChapter, selectedVerseRef, isSearchView]);

  // ------------------ HANDLE URL HASH CHANGE (OAuth-safe) ------------------
  /**
   * This parser reads our own deep-link hashes like:
   *   #/Genesis/1
   *   #/Genesis/1/3
   *
   * But it must ignore Supabase's auth hashes:
   *   #access_token=...
   */
  useEffect(() => {
    const parseHashAndSetState = (hash: string) => {
      // Ignore Supabase OAuth hashes entirely
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

      const bookName = decodeURIComponent(parts[0].replace(/\+/g, " "));
      const chapterNum = parseInt(parts[1], 10);
      const verseNum = parts[2] ? parseInt(parts[2], 10) : null;

      const bookMeta = findBookMetadata(bookName);
      if (
        !bookMeta ||
        isNaN(chapterNum) ||
        chapterNum < 1 ||
        chapterNum > bookMeta.chapters
      ) {
        console.warn("Invalid reference in URL hash:", hash);
        return;
      }

      setSelectedBook(bookMeta.name);
      setSelectedChapter(chapterNum);

      if (verseNum) {
        const newVerseRef = {
          book: bookMeta.name,
          chapter: chapterNum,
          verse: verseNum,
        };
        setSelectedVerseRef(newVerseRef);

        if (window.innerWidth < 768) setIsToolsModalOpen(true);
      } else {
        setSelectedVerseRef(null);
        setIsToolsModalOpen(false);
      }
    };

    const handleHashChange = () => {
      const hash = window.location.hash;
      parseHashAndSetState(hash);
    };

    const initialHash = window.location.hash;

    // Process initial hash only if it's NOT an OAuth hash
    if (
      initialHash &&
      !initialHash.startsWith("#access_token") &&
      !initialHash.includes("access_token=") &&
      !initialHash.includes("refresh_token=")
    ) {
      parseHashAndSetState(initialHash);
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // ------------------ LOAD VERSES ------------------
  useEffect(() => {
    if (isSearchView) return;

    const loadVerses = async () => {
      setIsLoadingVerses(true);
      setVerseError(null);

      try {
        const fetchedVerses = await fetchChapter(selectedBook, selectedChapter);
        setVerses(fetchedVerses);
      } catch (err) {
        console.error(err);
        setVerseError("Failed to load chapter.");
        setVerses([]);
      } finally {
        setIsLoadingVerses(false);
      }
    };

    loadVerses();
  }, [selectedBook, selectedChapter, isSearchView]);

  // ------------------ NAVIGATION HELPERS ------------------
  const handleBookChange = useCallback((book: string) => {
    setSelectedBook(book);
    setSelectedChapter(1);
    setSelectedVerseRef(null);
    setIsToolsModalOpen(false);
  }, []);

  const handleChapterChange = useCallback((chapter: number) => {
    setSelectedChapter(chapter);
    setSelectedVerseRef(null);
    setIsToolsModalOpen(false);
  }, []);

  const handleNextChapter = useCallback(() => {
    const bookMeta = BIBLE_META.find((b) => b.name === selectedBook);
    if (!bookMeta) return;

    if (selectedChapter < bookMeta.chapters) {
      handleChapterChange(selectedChapter + 1);
    } else {
      const currentBookIndex = BIBLE_META.findIndex(
        (b) => b.name === selectedBook
      );
      if (currentBookIndex < BIBLE_META.length - 1) {
        const nextBook = BIBLE_META[currentBookIndex + 1];
        handleBookChange(nextBook.name);
      }
    }
  }, [selectedBook, selectedChapter, handleBookChange, handleChapterChange]);

  const handlePreviousChapter = useCallback(() => {
    if (selectedChapter > 1) {
      handleChapterChange(selectedChapter - 1);
    } else {
      const currentBookIndex = BIBLE_META.findIndex(
        (b) => b.name === selectedBook
      );
      if (currentBookIndex > 0) {
        const prevBook = BIBLE_META[currentBookIndex - 1];
        setSelectedBook(prevBook.name);
        setSelectedChapter(prevBook.chapters);
        setSelectedVerseRef(null);
        setIsToolsModalOpen(false);
      }
    }
  }, [selectedBook, selectedChapter, handleChapterChange]);

  // ------------------ SCROLL DIRECTION ------------------
  const handleScrollDirectionChange = useCallback((direction: "up" | "down") => {
    setIsNavVisible(direction === "up");
  }, []);

  // ------------------ VERSE SELECTION ------------------
  const handleVerseSelect = useCallback(
    (verseNum: number) => {
      setSelectedVerseRef({
        book: selectedBook,
        chapter: selectedChapter,
        verse: verseNum,
      });
      if (window.innerWidth < 768) setIsToolsModalOpen(true);
      setIsChatOpen(false);
    },
    [selectedBook, selectedChapter]
  );

  // ------------------ SEARCH LOGIC ------------------
  const parseReferencesFromString = (refString: string): ParsedReference[] => {
    const parts = refString.split(/\s*[;,]\s*/);
    const parsed: ParsedReference[] = [];

    const referenceRegex =
      /^([1-3]?\s*[A-Za-z\u0C00-\u0C7F.'’\-\u00A0]+?)\s+(\d+)\s*:\s*(\d+)(?:-(\d+))?$/u;

    for (const rawPart of parts) {
      const text = rawPart.trim();
      if (!text) continue;

      const normalizedWhole = normalizeTeluguReference(text);
      const m = normalizedWhole.match(referenceRegex);
      if (!m) continue;

      const bookCandidate = m[1].trim();
      const chapterNum = parseInt(m[2], 10);
      const startVerseNum = parseInt(m[3], 10);
      const endVerseNum = m[4] ? parseInt(m[4], 10) : undefined;

      if (isNaN(chapterNum) || isNaN(startVerseNum)) continue;

      const bookMeta = findBookMetadata(bookCandidate);
      if (!bookMeta) continue;

      if (chapterNum < 1 || chapterNum > bookMeta.chapters) continue;
      if (endVerseNum !== undefined && endVerseNum < startVerseNum) continue;

      parsed.push({
        book: bookMeta.name,
        chapter: chapterNum,
        startVerse: startVerseNum,
        endVerse: endVerseNum,
      });
    }

    return parsed;
  };

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearchError(null);

    const normalizedQueryForParse = normalizeTeluguReference(query);
    const parsedRefs = parseReferencesFromString(normalizedQueryForParse);

    if (parsedRefs.length > 1) {
      setIsSearching(true);
      try {
        const results = await fetchVersesByReferences(parsedRefs);
        setSearchResults(results);
        setIsSearchView(true);
      } catch (err) {
        console.error(err);
        setSearchError("Failed to fetch results.");
      } finally {
        setIsSearching(false);
        setSearchQuery("");
      }
      return;
    }

    if (parsedRefs.length === 1) {
      const ref = parsedRefs[0];
      const bookMeta = BIBLE_META.find((b) => b.name === ref.book);

      if (!bookMeta || ref.chapter < 1 || ref.chapter > bookMeta.chapters) {
        setSearchError(`Invalid chapter for ${ref.book}.`);
        return;
      }

      setIsSearchView(false);
      setSelectedBook(ref.book);
      setSelectedChapter(ref.chapter);

      if (ref.startVerse) {
        setSelectedVerseRef({
          book: ref.book,
          chapter: ref.chapter,
          verse: ref.startVerse,
        });
      } else {
        setSelectedVerseRef(null);
      }

      setSearchQuery("");
      return;
    }

    setIsSearching(true);
    try {
      const normalizedForAI = normalizeTeluguReference(query);
      const referenceString = await searchBibleByKeyword(normalizedForAI);

      if (!referenceString || !referenceString.trim()) {
        setSearchError(`No verses found for "${query}".`);
        setSearchResults([]);
        setIsSearchView(true);
        return;
      }

      const normalizedRefString = normalizeTeluguReference(referenceString);
      const keywordRefs = parseReferencesFromString(normalizedRefString);

      if (keywordRefs.length === 0) {
        setSearchError(`Could not parse results for "${query}".`);
        setSearchResults([]);
        setIsSearchView(true);
        return;
      }

      const results = await fetchVersesByReferences(keywordRefs);
      setSearchResults(results);
      setIsSearchView(true);
    } catch (err) {
      console.error(err);
      setSearchError("An error occurred during keyword search.");
    } finally {
      setIsSearching(false);
      setSearchQuery("");
    }
  };

  const handleClearSearch = () => {
    setIsSearchView(false);
    setSearchResults([]);
    setSearchError(null);
  };

  // ------------------ METADATA ------------------
  const selectedBookMeta = BIBLE_META.find((b) => b.name === selectedBook);
  const chapterCount = selectedBookMeta ? selectedBookMeta.chapters : 0;
  const selectedVerseData = selectedVerseRef
    ? verses.find((v) => v.verse === selectedVerseRef.verse)
    : null;

  const isFirstChapterOfBible =
    selectedBook === "Genesis" && selectedChapter === 1;
  const isLastChapterOfBible =
    selectedBook === "Revelation" && selectedChapter === 22;

  // ------------------ RENDER ------------------
  return (
    <LanguageProvider>
      {loading ? (
        // SAFE LOADING SCREEN (no hooks used here)
        <div className="flex items-center justify-center h-screen text-gray-700 dark:text-gray-300">
          Loading...
        </div>
      ) : (
        // FULL APP UI — all hooks run before this block
        <div className="flex flex-col h-screen font-sans">
          {showWelcome && <WelcomeScreen onDismiss={handleWelcomeDismiss} />}

          {/* HEADER */}
{/* HEADER */}
<header
  className="
    bg-white dark:bg-gray-900 p-3 shadow-md z-10 
    border-b border-gray-200 dark:border-[#2A2F35]
    flex flex-col md:flex-row md:items-center md:justify-between gap-3
  "
>

  {/* TITLE + PROFILE (MOBILE ONLY) */}
  <div className="flex md:hidden items-center justify-between px-4">
    {/* Title Left */}
    <div className="flex items-center gap-4 py-2">
      <div className="w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white">
        <i className="fas fa-book-open text-lg" />
      </div>

      <div className="flex flex-col">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-[#E5E5E5]">
          AI Bible Study Companion
        </h1>
        <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">
          by Joel Prem
        </span>
      </div>
    </div>

    {/* Profile Right */}
    <ProfileMenu />
  </div>

  {/* DESKTOP TITLE (unchanged) */}
  <div className="hidden md:flex items-center gap-4 ml-4 py-2">
    <div className="w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white">
      <i className="fas fa-book-open text-lg" />
    </div>

    <div className="flex flex-col">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-[#E5E5E5]">
        AI Bible Study Companion
      </h1>
      <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">
        by Joel Prem
      </span>
    </div>
  </div>

  {/* SEARCH BAR + PROFILE (DESKTOP LAYOUT SAME AS ORIGINAL) */}
  <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-3 px-4 md:px-0">

    {/* Search */}
    <form
      onSubmit={handleSearch}
      className="flex-1 md:w-80 max-w-md flex items-center"
    >
      <div className="
        flex w-full rounded-lg overflow-hidden 
        transform-gpu transition-all duration-200 ease-out
        hover:shadow-[0_0_14px_rgba(59,130,246,0.55)] 
        dark:hover:shadow-[0_0_16px_rgba(59,130,246,0.65)]
      ">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search (Psalm 23:1, Romans 8:1–4 | యోహాను 3:16)"
          className="
            bg-gray-50 border border-gray-300 text-gray-900 text-sm 
            dark:bg-gray-800 dark:border-[#2A2F35] dark:text-[#E5E5E5] 
            w-full p-2.5 outline-none
          "
        />
        <button
          type="submit"
          className="
            px-4 text-white bg-blue-600 hover:bg-blue-700 
            border border-blue-600 
            dark:bg-blue-600 dark:hover:bg-blue-700
          "
        >
          <i className="fas fa-search" />
        </button>
      </div>
    </form>

    {/* Desktop Profile EXACT SAME PLACE */}
    <div className="hidden md:block">
      <ProfileMenu />
    </div>

  </div>
</header>



          {/* MAIN CONTENT */}
          <main className="flex-grow flex flex-col md:flex-row overflow-hidden">
            {isSearchView ? (
              <SearchResultDisplay
                results={searchResults}
                isLoading={isSearching}
                error={searchError}
                onClear={handleClearSearch}
                englishVersion={englishVersion}
              />
            ) : (
              <>
                <div className="w-full md:w-2/3 flex flex-col h-full min-h-0 overflow-hidden">
                  <div
                    className={`transition-all duration-300 ease-in-out relative z-0 ${
                      isNavVisible ? "mt-0" : "-mt-32"
                    } md:mt-0`}
                  >
                    <NavigationPane
                      books={BIBLE_META.map((b) => b.name)}
                      selectedBook={selectedBook}
                      selectedChapter={selectedChapter}
                      chapterCount={chapterCount}
                      onBookChange={handleBookChange}
                      onChapterChange={handleChapterChange}
                      englishVersion={englishVersion}
                      onEnglishVersionChange={setEnglishVersion}
                      englishVersions={["ESV", "NIV", "KJV"]}
                      onNextChapter={handleNextChapter}
                      onPreviousChapter={handlePreviousChapter}
                      isFirstChapterOfBible={isFirstChapterOfBible}
                      isLastChapterOfBible={isLastChapterOfBible}
                    />
                  </div>

                  <ScriptureDisplay
                    bookName={selectedBook}
                    chapterNum={selectedChapter}
                    verses={verses}
                    isLoading={isLoadingVerses}
                    error={verseError}
                    englishVersion={englishVersion}
                    onVerseSelect={handleVerseSelect}
                    selectedVerseRef={selectedVerseRef}
                    onNextChapter={handleNextChapter}
                    onPreviousChapter={handlePreviousChapter}
                    onScrollDirectionChange={handleScrollDirectionChange}
                    highlights={highlights}
                  />
                </div>

                <div className="w-full md:w-1/3 hidden md:block overflow-y-auto bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-[#2A2F35]">
                  {selectedVerseRef && selectedVerseData ? (
                    <VerseTools
                      verseRef={selectedVerseRef}
                      verseData={selectedVerseData}
                      englishVersion={englishVersion}
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
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8 text-center">
                      <p>
                        Select a verse to see detailed tools like Interlinear, Cross-references,
                        Historical Context, and Notes.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>

          {/* MOBILE MODAL */}
          {isToolsModalOpen && selectedVerseRef && selectedVerseData && (
            <div
              className="md:hidden fixed inset-0 bg-black bg-opacity-60 z-30"
              onClick={() => setIsToolsModalOpen(false)}
            >
              <div
                className="fixed bottom-0 left-0 right-0 h-[85vh] bg-white dark:bg-gray-900 rounded-t-2xl shadow-lg overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <VerseTools
                  verseRef={selectedVerseRef}
                  verseData={selectedVerseData}
                  englishVersion={englishVersion}
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

          <footer className="bg-gray-200 dark:bg-[#111418] text-center p-2 text-xs text-gray-600 dark:text-[#9CA3AF] border-t border-gray-300 dark:border-[#2A2F35]">
            Contact: joelpremtej@gmail.com
          </footer>

          <Chatbot
            selectedBook={selectedBook}
            selectedChapter={selectedChapter}
            selectedVerseRef={selectedVerseRef}
            verses={verses}
            englishVersion={englishVersion}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(!isChatOpen)}
          />
        </div>
      )}
    </LanguageProvider>
  );
};

export default App;
