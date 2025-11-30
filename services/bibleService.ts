// src/services/bibleService.ts
//
// Complete, production-ready bibleService with aggressive normalization
// (Telugu synonyms, English abbreviations, numeric handling, transliterations).
//
// Replaces previous brittle normalization logic — copy this file exactly.

import type { Verse, ParsedReference, FullVerse } from '../types';
import { BIBLE_META_WITH_VERSE_COUNTS } from '../data/bibleMetaWithVerseCounts';
import { teluguBibleData } from '../data/telugubible';
import { TELUGU_BOOK_NAMES } from '../data/teluguBookNames';

const API_BASE_URL = 'https://bible-api.com/';

// ------------------------------
// Book metadata
// ------------------------------
export const BIBLE_META = BIBLE_META_WITH_VERSE_COUNTS.map(book => ({
  name: book.name,
  chapters: book.chapters.length,
}));

// English -> Telugu official mapping (keep original)
const ENGLISH_TO_TELUGU = TELUGU_BOOK_NAMES;

// Build abbreviation -> English canonical (common English abbrs)
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

// ------------------------------
// Telugu mappings
// ------------------------------
// Build TELUGU_TO_ENGLISH from TELUGU_BOOK_NAMES (reverse)
const TELUGU_TO_ENGLISH: Record<string, string> = Object.fromEntries(
  Object.entries(TELUGU_BOOK_NAMES).map(([eng, tel]) => [tel, eng])
);

// Aggressive synonym map (Telugu short forms, colloquial forms, transliteration stubs, english abbreviations).
// This is intentionally comprehensive (covers common variants and short forms).
export const TELUGU_SYNONYMS: Record<string, string> = {
  // Old Testament variants
  "ఆదికాండము": "Genesis", "ఆదికాండం": "Genesis", "ఆది": "Genesis", "ఆదికాండ": "Genesis",
  "నిర్గమకాండము": "Exodus", "నిర్గమకాండం": "Exodus", "నిర్గమము": "Exodus", "నిర్గమం": "Exodus",
  "లేవీయకాండము": "Leviticus", "లేవీయకాండం": "Leviticus",
  "సంఖ్యాకాండము": "Numbers", "సంఖ్యాకాండం": "Numbers", "సంఖ్యలు": "Numbers",
  "ద్వితీయోపదేశకాండము": "Deuteronomy", "ద్వితీయోపదేశము": "Deuteronomy",
  "యెహోషువ": "Joshua", "న్యాయాధిపతులు": "Judges", "న్యాయాధిపతి": "Judges",
  "రూతు": "Ruth", "1 సమూయేలు": "1 Samuel", "2 సమూయేలు": "2 Samuel",
  "1 రాజులు": "1 Kings", "2 రాజులు": "2 Kings",
  "1 దినవృత్తాంతములు": "1 Chronicles", "2 దినవృత్తాంతములు": "2 Chronicles",
  "ఎజ్రా": "Ezra", "నెహెమ్యా": "Nehemiah", "ఎస్తేరు": "Esther",
  "యోబు": "Job","యోబు గ్రంథం":"Job",

  // Psalms and related common short forms
  "కీర్తనల గ్రంథము": "Psalms", "కీర్తనల గ్రంథం": "Psalms", "కీర్తనలు": "Psalms", "కీర్తన": "Psalms", "కీర్తనల": "Psalms",

  "సామెతలు": "Proverbs", "సామెత": "Proverbs",
  "ప్రసంగి": "Ecclesiastes", "కొహేలెత్": "Ecclesiastes",

  "పరమగీతము": "Song of Solomon", "పరమగీతం": "Song of Solomon", "పరమగీత": "Song of Solomon",

  "యెషయా": "Isaiah", "యిర్మియా": "Jeremiah", "యిర్మీయా": "Jeremiah",
  "విలాపవాక్యములు": "Lamentations", "విలాపవాక్యాలు": "Lamentations",
  "యెహెజ్కేలు": "Ezekiel", "దానియేలు": "Daniel",

  "హోషేయా": "Hosea", "యోవేలు": "Joel", "ఆమోసు": "Amos", "ఓబద్యా": "Obadiah",
  "యోనా": "Jonah", "మీకా": "Micah", "నాహూము": "Nahum", "హబక్కూకు": "Habakkuk",
  "సెఫన్యా": "Zephaniah", "హగ్గయి": "Haggai", "జెకర్యా": "Zechariah", "మలాకీ": "Malachi",

  // New Testament common forms
  "మత్తయి": "Matthew", "మార్కు": "Mark", "లూకా": "Luke", "యోహాను": "John",
  "యోహాను సువార్త": "John", "యోహానుతో": "John",

  "అపొస్తలుల కార్యములు": "Acts", "అపొస్తలుల": "Acts", "ప్రేరితుల కార్యములు": "Acts",
  "రోమీయులకు": "Romans", "రోమా": "Romans",

  "1 కొరింథీయులకు": "1 Corinthians", "2 కొరింథీయులకు": "2 Corinthians",
  "గలతీయులకు": "Galatians", "ఎఫెసీయులకు": "Ephesians",
  "ఫిలిప్పీయులకు": "Philippians", "కొలస్సయులకు": "Colossians",

  "1 థెస్సలొనీకయులకు": "1 Thessalonians", "2 థెస్సలొనీకయులకు": "2 Thessalonians",

  // Timothy family (critical)
  "1 తిమోతికి": "1 Timothy", "1 తిమోతి": "1 Timothy", "1 తిమోతి పత్రిక": "1 Timothy",
  "2 తిమోతికి": "2 Timothy", "2 తిమోతి": "2 Timothy", "2 తిమోతి పత్రిక": "2 Timothy",

  "తీతుకు": "Titus","తీతు": "Titus", "ఫిలేమోనుకు": "Philemon", "ఫిలేమోను": "Philemon",
  "హెబ్రీయులకు": "Hebrews", "హెబ్రీ": "Hebrews",
  "యాకోబు": "James",

  "1 పేతురు": "1 Peter", "2 పేతురు": "2 Peter",

  "1 యోహాను": "1 John", "2 యోహాను": "2 John", "3 యోహాను": "3 John",

  "యూదా": "Jude",
  "ప్రకటన గ్రంథము": "Revelation", "ప్రకటన": "Revelation",

  // Short/colloquial and transliteration stubs (English-ish inputs)
  "gen": "Genesis", "genesis": "Genesis", "exod": "Exodus", "ps": "Psalms",
  "psalm": "Psalms", "psalms": "Psalms", "prov": "Proverbs", "prov.": "Proverbs",
  "song": "Song of Solomon", "song of solomon": "Song of Solomon",
  // common romanizations for Telugu names (small set)
  "yohanu": "John", "mattai": "Matthew", "matthew": "Matthew",
  "1 tim": "1 Timothy", "2 tim": "2 Timothy", "1tim": "1 Timothy", "2tim": "2 Timothy",
  "tim": "1 Timothy",
  // add numeric shorthand english
  "1cor": "1 Corinthians", "2cor": "2 Corinthians", "rom": "Romans", "roms": "Romans",
};

// Add reverse English -> synonyms (for lookup fallback): create a small English alias map
const ENGLISH_ALIASES: Record<string, string> = {
  // english full names and common variants -> canonical English
  "psalm": "Psalms", "psalms": "Psalms", "song": "Song of Solomon",
  "song of songs": "Song of Solomon", "songs": "Song of Solomon",
  "1sam": "1 Samuel", "2sam": "2 Samuel", "1kgs": "1 Kings"
  // This map is small — abbreviationToBookName handles many abbrs.
};

// ------------------------------
// Telugu bible typed structure & index map
// ------------------------------
interface TeluguVerse { Verseid: string; Verse: string; }
interface TeluguChapter { Verse: TeluguVerse[]; }
interface TeluguBook { Chapter: TeluguChapter[]; }
interface TeluguBible { Book: TeluguBook[]; }

const typedTeluguBibleData = teluguBibleData as unknown as TeluguBible;

// Build bookName -> index map assuming BIBLE_META_WITH_VERSE_COUNTS order
const bookNameToIndexMap = new Map<string, number>();
BIBLE_META_WITH_VERSE_COUNTS.forEach((b, i) => bookNameToIndexMap.set(b.name, i));

// ------------------------------
// Helpers
// ------------------------------

// Replace Telugu digits (౦-౯) with ASCII digits
function replaceTeluguDigits(s: string): string {
  if (!s) return s;
  return s.replace(/[\u0C66-\u0C6F]/g,(ch=>{
    const zeroCode = 0x0C66;
    // @ts-ignore
    return String(ch.charCodeAt(0) - zeroCode);
  }));
}

// Trim and normalize whitespace and punctuation
function normalizeWhitespace(s: string): string {
  return s.replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();
}

// Extract numeric prefix (1,2,3) either at start or end; handles Telugu numerals
function extractNumericPrefix(bookRaw: string): { num?: string; name: string } {
  let s = replaceTeluguDigits(bookRaw);
  s = normalizeWhitespace(s);

  // Check prefix like "1 " or "1."
  const mPrefix = s.match(/^([1-3])\s+(.+)$/);
  if (mPrefix) return { num: mPrefix[1], name: mPrefix[2].trim() };

  // Check suffix like "Book 1" or "నామం 1"
  const mSuffix = s.match(/^(.+?)\s+([1-3])$/);
  if (mSuffix) return { num: mSuffix[2], name: mSuffix[1].trim() };

  // Check Telugu numerals prefixed (e.g., "౧ తిమోతి")
  const mTelNumPrefix = bookRaw.match(/^[\u0C66-\u0C6F]\s*(.+)$/);
  if (mTelNumPrefix) {
    // convert telugu digit to ascii
    const telNum = replaceTeluguDigits(mTelNumPrefix[0].charAt(0));
    return { num: telNum, name: mTelNumPrefix[1].trim() };
  }

  return { name: s };
}

// canonicalize string for lookups (lowercase ascii, trim punctuation)
function canonicalKey(s: string): string {
  return s.toLowerCase().replace(/[.,;:!؟؟\u200B®™*(){}[\]"']/g, '').trim();
}

// Try English abbreviation match
function tryEnglishAbbreviation(book: string): string | undefined {
  if (!book) return undefined;
  const key = canonicalKey(book).replace(/\s+/g,'');
  const maybe = abbreviationToBookName[key] || abbreviationToBookName[book.toLowerCase()];
  if (maybe) return maybe;
  // small alias map
  const alias = ENGLISH_ALIASES[book.toLowerCase()];
  if (alias) return alias;
  return undefined;
}

// Main normalization: accepts raw book (Telugu/English/abbr), returns canonical English book name (or original)
export function canonicalizeBook(raw: string): string {
  if (!raw) return raw;

  // normalize whitespace & remove stray punctuation
  raw = normalizeWhitespace(raw);

  // handle cases where the raw includes "chapter:verse"—strip them before calling canonicalizeBook
  const withoutCv = raw.replace(/\s*\d+:\d+(-\d+)?\s*$/, '').trim();

  // extract numeric prefix/suffix
  const { num, name } = extractNumericPrefix(withoutCv);

  // canonical forms to try (priority order)
  const tries: string[] = [];

  // 1) If name already english ASCII characters, try english abbreviation/book matching
  const isAscii = /^[\x00-\x7F]*$/.test(name);
  if (isAscii) {
    // try abbreviation first (e.g., "1 Tim", "rom")
    const abbrTry = tryEnglishAbbreviation(`${num ? num + ' ' : ''}${name}`);
    if (abbrTry) return abbrTry;

    // try direct match against BIBLE_META
    const direct = BIBLE_META.find(b => b.name.toLowerCase() === name.toLowerCase());
    if (direct) return direct.name;

    // try starts-with English
    const starts = BIBLE_META.find(b => b.name.toLowerCase().startsWith(name.toLowerCase()));
    if (starts) return starts.name;
  }

  // 2) Try exact telugu -> english reverse map: TELUGU_TO_ENGLISH and TELUGU_SYNONYMS
  // Try with numeric prefix included first (e.g., "1 తిమోతి")
  if (num) {
    tries.push(`${num} ${name}`);
    tries.push(`${num}${name}`);
    tries.push(`${name} ${num}`);
  }
  tries.push(name);

  for (const t of tries) {
    const key = t.trim();
    // exact match in synonym map (case-insensitive canonicalization for english-ish keys)
    const kLower = canonicalKey(key);
    // direct TELUGU_SYNONYMS match (keys may be telugu or english abbrev)
    if (TELUGU_SYNONYMS[key]) return TELUGU_SYNONYMS[key];
    if (TELUGU_SYNONYMS[kLower]) return TELUGU_SYNONYMS[kLower];

    // direct TELUGU_TO_ENGLISH exact (Telugu official)
    if (TELUGU_TO_ENGLISH[key]) return TELUGU_TO_ENGLISH[key];
    if (TELUGU_TO_ENGLISH[kLower]) return TELUGU_TO_ENGLISH[kLower];

    // try english-like matches (romanized variants)
    const roman = key.toLowerCase();
    if (TELUGU_SYNONYMS[roman]) return TELUGU_SYNONYMS[roman];
  }

  // 3) Try english abbreviations / starts-with on original raw
  const abbr = tryEnglishAbbreviation(withoutCv);
  if (abbr) return abbr;

  // 4) As a last resort, try starts-with on english BIBLE_META using the name (without num)
  const lowerName = name.toLowerCase();
  const starts = BIBLE_META.find(b => b.name.toLowerCase().startsWith(lowerName));
  if (starts) return starts.name;

  // 5) fallback: return input trimmed (may be english already)
  return raw;
}

// ------------------------------
// Telugu verse lookup
// ------------------------------
function getTeluguVerse(book: string, chapter: number, verse: number): string | undefined {
  // book here should be canonical English name (e.g., "1 Timothy")
  const idx = bookNameToIndexMap.get(book);
  if (idx === undefined) return undefined;
  try {
    return typedTeluguBibleData.Book[idx]?.Chapter[chapter - 1]?.Verse[verse - 1]?.Verse;
  } catch (e) {
    console.error('Telugu verse access error', e);
    return undefined;
  }
}

// ------------------------------
// normalizeTeluguReference: convert a string that MAY begin with a telugu book name to english.
// This function replaces the book portion only and returns the new string.
// ------------------------------
export function normalizeTeluguReference(query: string): string {
  if (!query) return query;
  let cleaned = normalizeWhitespace(query);

  // Extract leading book portion (before chapter:verse if present)
  const m = cleaned.match(/^([1-3]?\s*[^\d:]+?)(?=\s+\d+[:\s]|$)/u);
  const bookPart = m ? m[1].trim() : null;

  if (!bookPart) return cleaned;

  const canonical = canonicalizeBook(bookPart);

  // Replace only the first occurrence of bookPart with canonical English
  const replaced = cleaned.replace(bookPart, canonical);
  return replaced;
}

// ------------------------------
// Bible API fetcher
// ------------------------------
interface BibleApiResponseVerse {
  book_id: string; book_name: string; chapter: number; verse: number; text: string;
}
interface BibleApiResponse {
  reference: string; verses: BibleApiResponseVerse[]; text: string; translation_id: string; translation_name: string;
}

async function fetchTranslationForReference(referenceString: string, version: string): Promise<BibleApiResponse> {
  const url = `${API_BASE_URL}${encodeURIComponent(referenceString)}?translation=${encodeURIComponent(version)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP error ${r.status} for ${referenceString} (${version})`);
  return r.json();
}

// ------------------------------
// fetchChapter
// ------------------------------
export const fetchChapter = async (book: string, chapter: number): Promise<Verse[]> => {
  // book may be Telugu or English: canonicalize to English before fetch
  const engBook = canonicalizeBook(book);
  const reference = `${engBook} ${chapter}`;

  const [webData, kjvData] = await Promise.all([
    fetchTranslationForReference(reference, 'web'),
    fetchTranslationForReference(reference, 'kjv'),
  ]);

  if (!kjvData.verses || kjvData.verses.length === 0) {
    throw new Error(`No KJV verses for ${reference}`);
  }

  return kjvData.verses.map(kjvVerse => {
    const webVerse = webData.verses.find(v => v.verse === kjvVerse.verse);
    const teluguText = getTeluguVerse(engBook, chapter, kjvVerse.verse);

    return {
      verse: kjvVerse.verse,
      text: {
        KJV: kjvVerse.text.replace(/\n/g, ' ').trim(),
        ESV: webVerse?.text.replace(/\n/g, ' ').trim() || kjvVerse.text.replace(/\n/g, ' ').trim(),
        NIV: webVerse?.text.replace(/\n/g, ' ').trim() || kjvVerse.text.replace(/\n/g, ' ').trim(),
        ...(teluguText && { BSI_TELUGU: teluguText }),
      }
    } as Verse;
  });
};

// ------------------------------
// fetchVersesByReferences
// ------------------------------
export const fetchVersesByReferences = async (references: ParsedReference[]): Promise<FullVerse[]> => {
  const fetchPromises = references.map(async (ref) => {
    // canonicalize the book name from ref (handles Telugu/English/abbrev)
    const engBook = canonicalizeBook(ref.book);

    const referenceString = ref.endVerse
      ? `${engBook} ${ref.chapter}:${ref.startVerse}-${ref.endVerse}`
      : `${engBook} ${ref.chapter}:${ref.startVerse}`;

    const [webData, kjvData] = await Promise.all([
      fetchTranslationForReference(referenceString, 'web'),
      fetchTranslationForReference(referenceString, 'kjv'),
    ]);

    if (!kjvData.verses || kjvData.verses.length === 0) {
      return [] as FullVerse[];
    }

    return kjvData.verses.map(kjvVerse => {
      const teluguText = getTeluguVerse(engBook, ref.chapter, kjvVerse.verse);
      const webVerse = webData.verses.find(v => v.verse === kjvVerse.verse);

      return {
        book: engBook,
        chapter: ref.chapter,
        verse: kjvVerse.verse,
        text: {
          KJV: kjvVerse.text.replace(/\n/g, ' ').trim(),
          ESV: webVerse?.text.replace(/\n/g, ' ').trim() || kjvVerse.text.replace(/\n/g, ' ').trim(),
          NIV: webVerse?.text.replace(/\n/g, ' ').trim() || kjvVerse.text.replace(/\n/g, ' ').trim(),
          ...(teluguText && { BSI_TELUGU: teluguText }),
        }
      } as FullVerse;
    });
  });

  const results = await Promise.all(fetchPromises);
  return results.flat();
};

// ------------------------------
// findBookMetadata — robust lookup for English / normalized Telugu names.
// ------------------------------
export const findBookMetadata = (
  query: string
): { name: string; chapters: number } | null => {
  if (!query) return null;

  const cleaned = query.trim();

  // normalize candidate to canonical English book name
  const eng = canonicalizeBook(cleaned);

  // direct exact match
  const direct = BIBLE_META.find(b => b.name.toLowerCase() === eng.toLowerCase());
  if (direct) return direct;

  // starts-with fallback
  const starts = BIBLE_META.find(b => b.name.toLowerCase().startsWith(eng.toLowerCase()));
  if (starts) return starts;

  // last resort: try english abbreviation map
  const abbr = tryEnglishAbbreviation(eng);
  if (abbr) {
    const found = BIBLE_META.find(b => b.name === abbr);
    if (found) return found;
  }

  return null;
};
