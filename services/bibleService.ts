// src/services/bibleService.ts
// Responsibilities:
// - fetchChapter: fetch English (web/kjv) and attach Telugu verses when available.
// - fetchVersesByReferences: fetch specific verse ranges.
// - normalizeTeluguReference: convert common Telugu book names -> English book names.
// - fetchGreekInterlinear: helper (NT only) to fetch Greek interlinear data (morph/gnt or hosted file).
// - findBookMetadata: robust lookup for English / normalized Telugu names.

import type { Verse, ParsedReference, FullVerse } from '../types';
import { BIBLE_META_WITH_VERSE_COUNTS } from '../data/bibleMetaWithVerseCounts';
import { teluguBibleData } from '../data/telugubible';
import { TELUGU_BOOK_NAMES } from '../data/teluguBookNames';
import { TELUGU_TO_ENGLISH_BOOK_MAP } from '../data/teluguToEnglishBookMap';
import { hebrewInterlinearData } from "../data/hebrewInterlinear";
import { greekInterlinearData } from "../data/greekInterlinear";

const API_BASE_URL = 'https://bible-api.com/';


// --- Book metadata & maps ---
export const BIBLE_META = BIBLE_META_WITH_VERSE_COUNTS.map(book => ({
  name: book.name,
  chapters: book.chapters.length,
}));

const bookNameToAbbreviation: { [key: string]: string } = {
  'Genesis': 'Gen', 'Exodus': 'Exod', 'Leviticus': 'Lev', 'Numbers': 'Num', 'Deuteronomy': 'Deut',
  'Joshua': 'Josh', 'Judges': 'Judg', 'Ruth': 'Ruth', '1 Samuel': '1 Sam', '2 Samuel': '2 Sam',
  '1 Kings': '1 Kgs', '2 Kings': '2 Kgs', '1 Chronicles': '1 Chr', '2 Chronicles': '2 Chr',
  'Ezra': 'Ezra', 'Nehemiah': 'Neh', 'Esther': 'Esth', 'Job': 'Job', 'Psalms': 'Ps',
  'Proverbs': 'Prov', 'Ecclesiastes': 'Eccl', 'Song of Solomon': 'Song', 'Isaiah': 'Isa',
  'Jeremiah': 'Jer', 'Lamentations': 'Lam', 'Ezekiel': 'Ezek', 'Daniel': 'Dan', 'Hosea': 'Hos',
  'Joel': 'Joel', 'Amos': 'Amos', 'Obadiah': 'Obad', 'Jonah': 'Jonah', 'Micah': 'Mic',
  'Nahum': 'Nah', 'Habakkuk': 'Hab', 'Zephaniah': 'Zeph', 'Haggai': 'Hag', 'Zechariah': 'Zech',
  'Malachi': 'Mal', 'Matthew': 'Matt', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John',
  'Acts': 'Acts', 'Romans': 'Rom', '1 Corinthians': '1 Cor', '2 Corinthians': '2 Cor',
  'Galatians': 'Gal', 'Ephesians': 'Eph', 'Philippians': 'Phil', 'Colossians': 'Col',
  '1 Thessalonians': '1 Thess', '2 Thessalonians': '2 Thess', '1 Timothy': '1 Tim',
  '2 Timothy': '2 Tim', 'Titus': 'Titus', 'Philemon': 'Phlm', 'Hebrews': 'Heb', 'James': 'Jas',
  '1 Peter': '1 Pet', '2 Peter': '2 Pet', '1 John': '1 John', '2 John': '2 John', '3 John': '3 John',
  'Jude': 'Jude', 'Revelation': 'Rev'
};

const abbreviationToBookName: { [key: string]: string } = Object.entries(bookNameToAbbreviation)
  .reduce((acc, [name, abbr]) => {
    acc[abbr.toLowerCase().replace(/\s/g, '')] = name;
    acc[abbr.toLowerCase()] = name;
    return acc;
  }, {} as { [key:string]: string });

// --- Telugu data integration ---
// teluguBibleData structure assumed same as earlier: { Book: [ { Chapter: [ { Verse: [ { Verseid, Verse } ] } ] } ] }
interface TeluguVerse { Verseid: string; Verse: string; }
interface TeluguChapter { Verse: TeluguVerse[]; }
interface TeluguBook { Chapter: TeluguChapter[]; }
interface TeluguBible { Book: TeluguBook[]; }
const typedTeluguBibleData = teluguBibleData as unknown as TeluguBible;

// Build bookName -> index map assuming order same as BIBLE_META_WITH_VERSE_COUNTS
const bookNameToIndexMap = new Map<string, number>();
BIBLE_META_WITH_VERSE_COUNTS.forEach((b, i) => bookNameToIndexMap.set(b.name, i));

function getTeluguVerse(book: string, chapter: number, verse: number): string | undefined {
  const idx = bookNameToIndexMap.get(book);
  if (idx === undefined) return undefined;
  try {
    return typedTeluguBibleData.Book[idx]?.Chapter[chapter - 1]?.Verse[verse - 1]?.Verse;
  } catch (e) {
    console.error('Telugu verse access error', e);
    return undefined;
  }
}

// --- TELUGU -> ENGLISH book normalization ---
/**
 * normalizeTeluguReference
 * If input begins with a Telugu book name (or exact match), replace it with English equivalent.
 * Also trims and returns the original string if no match.
 */
export function normalizeTeluguReference(query: string): string {
  if (!query) return query;
  let cleaned = query.trim();

  // Try exact startsWith matches using TELUGU_TO_ENGLISH_BOOK_MAP
  for (const [telugu, english] of Object.entries(TELUGU_TO_ENGLISH_BOOK_MAP)) {
    // match when query starts with Telugu name or exact equals
    if (cleaned.startsWith(telugu)) {
      cleaned = cleaned.replace(telugu, english);
      return cleaned;
    }
  }

  // Also support mapping english -> english (no-op) and slight fuzzy matches:
  const lower = cleaned.toLowerCase();
  for (const book of BIBLE_META.map(b => b.name)) {
    if (book.toLowerCase().startsWith(lower)) return book;
  }

  return cleaned;
}
  
// --- Fetch functions using bible-api.com ---
interface BibleApiResponseVerse {
  book_id: string; book_name: string; chapter: number; verse: number; text: string;
}

interface BibleApiResponse {
  reference: string; verses: BibleApiResponseVerse[]; text: string; translation_id: string; translation_name: string; translation_note: string;
}

async function fetchTranslationForReference(referenceString: string, version: string): Promise<BibleApiResponse> {
  const url = `${API_BASE_URL}${encodeURIComponent(referenceString)}?translation=${encodeURIComponent(version)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP error ${r.status} for ${referenceString} (${version})`);
  return r.json();
}

export const fetchChapter = async (book: string, chapter: number, includeInterlinear = false): Promise<Verse[]> => {
  const reference = `${book} ${chapter}`;

  try {
    const [webData, kjvData] = await Promise.all([
      fetchTranslationForReference(reference, 'web'),
      fetchTranslationForReference(reference, 'kjv'),
    ]);

    if (!kjvData.verses || kjvData.verses.length === 0) {
      throw new Error(`No KJV verses for ${reference}`);
    }


    const merged = kjvData.verses.map(kjvVerse => {
      const webVerse = webData.verses.find(v => v.verse === kjvVerse.verse);
      const teluguText = getTeluguVerse(book, chapter, kjvVerse.verse);
      const kjvText = kjvVerse.text.replace(/\n/g, ' ').trim();
      const webText = webVerse ? webVerse.text.replace(/\n/g, ' ').trim() : kjvText;
      return {
        verse: kjvVerse.verse,
        text: {
          KJV: kjvText,
          ESV: webText,
          NIV: webText,
          ...(teluguText && { BSI_TELUGU: teluguText }),
        }
      } as Verse;
    });

    return merged;
  } catch (e) {
    console.error('fetchChapter error', e);
    throw e;
  }
};

export const fetchVersesByReferences = async (references: ParsedReference[]): Promise<FullVerse[]> => {
  const fetchPromises = references.map(async (ref) => {
    const referenceString = ref.endVerse
      ? `${ref.book} ${ref.chapter}:${ref.startVerse}-${ref.endVerse}`
      : `${ref.book} ${ref.chapter}:${ref.startVerse}`;

    const [webData, kjvData] = await Promise.all([
      fetchTranslationForReference(referenceString, 'web'),
      fetchTranslationForReference(referenceString, 'kjv'),
    ]);

    if (!kjvData.verses || kjvData.verses.length === 0) {
      console.warn(`No KJV verses for ${referenceString}`);
      return [] as FullVerse[];
    }

    // Attempt to attach Telugu per verse
    const merged: FullVerse[] = kjvData.verses.map(kjvVerse => {
      const teluguText = getTeluguVerse(ref.book, ref.chapter, kjvVerse.verse);
      const webVerse = webData.verses.find(v => v.verse === kjvVerse.verse);
      const kjvText = kjvVerse.text.replace(/\n/g, ' ').trim();
      const webText = webVerse ? webVerse.text.replace(/\n/g, ' ').trim() : kjvText;
      return {
        book: ref.book,
        chapter: ref.chapter,
        verse: kjvVerse.verse,
        text: {
          KJV: kjvText,
          ESV: webText,
          NIV: webText,
          ...(teluguText && { BSI_TELUGU: teluguText })
        }
      } as FullVerse;
    });

    return merged;
  });

  const results = await Promise.all(fetchPromises);
  return results.flat();
};

// --- Search utilities ---
export const findBookMetadata = (query: string): { name: string; chapters: number } | null => {
  const cleaned = (query || "").trim().toLowerCase();
  const cleanedNoSpace = cleaned.replace(/\s/g, '');

  // direct full name
  const full = BIBLE_META.find(b => b.name.toLowerCase() === cleaned);
  if (full) return full;

  // abbreviation
  const abbrMatch = abbreviationToBookName[cleanedNoSpace] || abbreviationToBookName[cleaned];
  if (abbrMatch) {
    const meta = BIBLE_META.find(b => b.name === abbrMatch);
    if (meta) return meta;
  }

  // check Telugus map (if user passes Telugu; normalizeTeluguReference already tries this but be defensive)
  for (const [tel, eng] of Object.entries(TELUGU_TO_ENGLISH_BOOK_MAP)) {
    if (cleaned.startsWith(tel.toLowerCase())) {
      const meta = BIBLE_META.find(b => b.name === eng);
      if (meta) return meta;
    }
  }

  // starts-with fallback
  const starts = BIBLE_META.find(b => b.name.toLowerCase().startsWith(cleaned));
  if (starts) return starts;

  return null;
};
