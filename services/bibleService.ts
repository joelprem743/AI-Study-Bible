// src/services/bibleService.ts
// Clean, accurate, non-destructive Bible book normalization.
// Telugu normalization triggers ONLY when Telugu script appears.

import type { Verse, ParsedReference, FullVerse } from '../types';
import { BIBLE_META_WITH_VERSE_COUNTS } from '../data/bibleMetaWithVerseCounts';
import { teluguBibleData } from '../data/telugubible';
import { TELUGU_BOOK_NAMES } from '../data/teluguBookNames';

const API_BASE_URL = 'https://bible-api.com/';

export const BIBLE_META = BIBLE_META_WITH_VERSE_COUNTS.map(book => ({
  name: book.name,
  chapters: book.chapters.length,
}));

// English → Telugu official mapping
const ENGLISH_TO_TELUGU = TELUGU_BOOK_NAMES;

// Abbreviations
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

const abbreviationToBookName: Record<string, string> = {};
for (const [name, abbr] of Object.entries(bookNameToAbbreviation)) {
  abbreviationToBookName[abbr.toLowerCase().replace(/\s/g, '')] = name;
  abbreviationToBookName[abbr.toLowerCase()] = name;
}

const TELUGU_TO_ENGLISH = Object.fromEntries(
  Object.entries(TELUGU_BOOK_NAMES).map(([eng, tel]) => [tel, eng])
);

// Telugu rich synonyms, but used only when Telugu detected in input
export const TELUGU_SYNONYMS: Record<string, string> = {
  "ఆదికాండము": "Genesis", "ఆదికాండం": "Genesis", "ఆది": "Genesis",
  "నిర్గమకాండము": "Exodus", "నిర్గమకాండం": "Exodus", "నిర్గమము": "Exodus",
  "లేవీయకాండము": "Leviticus", "సంఖ్యాకాండము": "Numbers", "సంఖ్యలు": "Numbers",
  "ద్వితీయోపదేశకాండము": "Deuteronomy",
  "యెహోషువ": "Joshua", "న్యాయాధిపతులు": "Judges",
  "రూతు": "Ruth",
  "1 సమూయేలు": "1 Samuel", "2 సమూయేలు": "2 Samuel",
  "1 రాజులు": "1 Kings", "2 రాజులు": "2 Kings",
  "1 దినవృత్తాంతములు": "1 Chronicles", "2 దినవృత్తాంతములు": "2 Chronicles",
  "ఎజ్రా": "Ezra", "నెహెమ్యా": "Nehemiah", "ఎస్తేరు": "Esther", "యోగు": "Job",

  "కీర్తనలు": "Psalms", "కీర్తన": "Psalms",

  "సామెతలు": "Proverbs",
  "ప్రసంగి": "Ecclesiastes",
  "పరమగీతము": "Song of Solomon",

  "యెషయా": "Isaiah", "యిర్మీయా": "Jeremiah",
  "విలాపవాక్యములు": "Lamentations",
  "యెహెజ్కేలు": "Ezekiel", "దానియేలు": "Daniel",
  "హోషేయా": "Hosea", "యోవేలు": "Joel", "ఆమోసు": "Amos",
  "ఓబద్యా": "Obadiah", "యోనా": "Jonah", "మీకా": "Micah",
  "నాహూము": "Nahum", "హబక్కూకు": "Habakkuk",
  "సెఫన్యా": "Zephaniah", "హగ్గయి": "Haggai", "జెకర్యా": "Zechariah",
  "మలాకీ": "Malachi",

  "మత్తయి": "Matthew", "మార్కు": "Mark", "లూకా": "Luke", "యోహాను": "John",
  "అపొస్తలుల కార్యములు": "Acts",
  "రోమీయులకు": "Romans",
  "1 కొరింథీయులకు": "1 Corinthians", "2 కొరింథీయులకు": "2 Corinthians",
  "గలతీయులకు": "Galatians", "ఎఫెసీయులకు": "Ephesians",
  "ఫిలిప్పీయులకు": "Philippians", "కొలస్సయులకు": "Colossians",
  "1 థెస్సలొనీకయులకు": "1 Thessalonians",
  "2 థెస్సలొనీకయులకు": "2 Thessalonians",

  "1 తిమోతికి": "1 Timothy", "2 తిమోతికి": "2 Timothy",
  "తీతు": "Titus",
  "ఫిలేమోను": "Philemon",
  "హెబ్రీయులకు": "Hebrews",
  "యాకోబు": "James",
  "1 పేతురు": "1 Peter", "2 పేతురు": "2 Peter",
  "1 యోహాను": "1 John", "2 యోహాను": "2 John", "3 యోహాను": "3 John",
  "యూదా": "Jude",
  "ప్రకటన": "Revelation"
};

function normalizeWhitespace(s: string): string {
  return s.replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();
}

function canonicalKey(s: string): string {
  return s.toLowerCase().replace(/[.,;:!?\u200B®™*(){}[\]"']/g, '').trim();
}

function tryEnglishAbbreviation(text: string): string | undefined {
  const k = canonicalKey(text).replace(/\s+/g, '');
  return abbreviationToBookName[k];
}

export function canonicalizeBook(raw: string): string {
  if (!raw) return raw;

  const containsTelugu = /[\u0C00-\u0C7F]/.test(raw);
  raw = normalizeWhitespace(raw);

  // strip trailing chapter/verse
  const stripped = raw.replace(/\s*\d+:\d+(-\d+)?\s*$/, '').trim();

  // English-only path
  if (!containsTelugu) {
    const ab = tryEnglishAbbreviation(stripped);
    if (ab) return ab;

    const direct = BIBLE_META.find(b => b.name.toLowerCase() === stripped.toLowerCase());
    if (direct) return direct.name;

    const starts = BIBLE_META.find(b => b.name.toLowerCase().startsWith(stripped.toLowerCase()));
    if (starts) return starts.name;

    return stripped;
  }

  // Telugu path only if Telugu detected
  if (TELUGU_TO_ENGLISH[stripped]) return TELUGU_TO_ENGLISH[stripped];
  if (TELUGU_SYNONYMS[stripped]) return TELUGU_SYNONYMS[stripped];

  return stripped;
}

function getTeluguVerse(book: string, chapter: number, verse: number): string | undefined {
  const idx = BIBLE_META_WITH_VERSE_COUNTS.findIndex(b => b.name === book);
  if (idx < 0) return undefined;
  try {
    return (teluguBibleData as any).Book[idx]?.Chapter[chapter - 1]?.Verse[verse - 1]?.Verse;
  } catch {
    return undefined;
  }
}

export function normalizeTeluguReference(query: string): string {
  if (!query) return query;
  const cleaned = normalizeWhitespace(query);

  const m = cleaned.match(/^([^\d:]+)\s+\d+:\d+/u);
  if (!m) return cleaned;

  const bookPart = m[1].trim();
  const canonical = canonicalizeBook(bookPart);
  return cleaned.replace(bookPart, canonical);
}

async function fetchTR(reference: string, version: string) {
  const r = await fetch(`${API_BASE_URL}${encodeURIComponent(reference)}?translation=${version}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const fetchChapter = async (book: string, chapter: number): Promise<Verse[]> => {
  const engBook = canonicalizeBook(book);
  const ref = `${engBook} ${chapter}`;

  const [web, kjv] = await Promise.all([
    fetchTR(ref, 'web'),
    fetchTR(ref, 'kjv')
  ]);

  return kjv.verses.map((v: any) => {
    const webVerse = web.verses.find((x: any) => x.verse === v.verse);
    const telugu = getTeluguVerse(engBook, chapter, v.verse);
    return {
      verse: v.verse,
      text: {
        KJV: v.text.trim(),
        ESV: (webVerse?.text?.trim() || v.text.trim()),
        NIV: (webVerse?.text?.trim() || v.text.trim()),
        ...(telugu && { BSI_TELUGU: telugu })
      }
    };
  });
};

export const fetchVersesByReferences = async (refs: ParsedReference[]): Promise<FullVerse[]> => {
  const blocks = await Promise.all(refs.map(async r => {
    const book = canonicalizeBook(r.book);
    const ref = r.endVerse
      ? `${book} ${r.chapter}:${r.startVerse}-${r.endVerse}`
      : `${book} ${r.chapter}:${r.startVerse}`;

    const [web, kjv] = await Promise.all([
      fetchTR(ref, 'web'),
      fetchTR(ref, 'kjv')
    ]);

    return kjv.verses.map((v: any) => {
      const webVerse = web.verses.find((x: any) => x.verse === v.verse);
      const telugu = getTeluguVerse(book, r.chapter, v.verse);

      return {
        book,
        chapter: r.chapter,
        verse: v.verse,
        text: {
          KJV: v.text.trim(),
          ESV: (webVerse?.text?.trim() || v.text.trim()),
          NIV: (webVerse?.text?.trim() || v.text.trim()),
          ...(telugu && { BSI_TELUGU: telugu })
        }
      };
    });
  }));

  return blocks.flat();
};

export const findBookMetadata = (query: string) => {
  if (!query) return null;
  const eng = canonicalizeBook(query.trim());

  const exact = BIBLE_META.find(b => b.name.toLowerCase() === eng.toLowerCase());
  if (exact) return exact;

  const starts = BIBLE_META.find(b => b.name.toLowerCase().startsWith(eng.toLowerCase()));
  if (starts) return starts;

  const ab = tryEnglishAbbreviation(eng);
  if (ab) {
    const meta = BIBLE_META.find(b => b.name === ab);
    if (meta) return meta;
  }

  return null;
};
