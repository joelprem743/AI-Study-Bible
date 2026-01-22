// src/lib/bibleVersesService.ts
import { supabase } from "./supabaseClient";

export type BibleVerseRow = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  version: string;
};

// ✅ Cache results (fast repeat reads)
const verseCache = new Map<string, BibleVerseRow>();

// ✅ Prevent duplicate simultaneous requests (in-flight dedupe)
const inflight = new Map<string, Promise<BibleVerseRow>>();

const cacheKey = (book: string, chapter: number, verse: number, version: string) =>
  `${version}:${book}:${chapter}:${verse}`;

export const fetchVerseByRef = async (
  book: string,
  chapter: number,
  verse: number,
  version: string
): Promise<BibleVerseRow> => {
  const key = cacheKey(book, chapter, verse, version);

  // 1) Return cached immediately
  const cached = verseCache.get(key);
  if (cached) return cached;

  // 2) If already fetching, reuse same promise
  const pending = inflight.get(key);
  if (pending) return pending;

  // 3) Fetch from Supabase
  const promise = (async () => {
    const res = await supabase
      .from("bible_verses")
      .select("book, chapter, verse, text, version")
      .eq("book", book)
      .eq("chapter", chapter)
      .eq("verse", verse)
      .eq("version", version)
      .single();

    if (res.error) throw res.error;

    const row = res.data as BibleVerseRow;

    // ✅ store in cache
    verseCache.set(key, row);

    return row;
  })();

  inflight.set(key, promise);

  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
};

// Optional: if you ever want to clear cache manually
export const clearVerseCache = () => {
  verseCache.clear();
  inflight.clear();
};
