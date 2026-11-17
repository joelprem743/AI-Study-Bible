// Shared scripture-reference detection and parsing.
//
// Used to turn references inside AI answers (Summary, Cross-references,
// Historical Context, chatbot) into clickable links, and to load the verses
// a reference points at for the preview popup.
//
// Handles, among others:
//   John 3:16            John 3:1-13 / 3:1–13 / 3:1 — 13 (any dash)
//   John 3:16, 18        John 3:16-18, 21     Genesis 1:1–2:3 (cross-chapter)
//   John 3               (whole chapter)      Psalm 23 / Ps. 23 / Psalms 23:1
//   1 Cor 13:4           1st Corinthians      I Corinthians / II Kings
//   Song of Songs 2:4    Jn 3:16 / Rom. 8:28  యోహాను 3:16 (Telugu names)
//   Romans 3:23; 6:23    (follow-on reference inherits the book)

import { BIBLE_META_WITH_VERSE_COUNTS } from "../data/bibleMetaWithVerseCounts";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";

export interface ScriptureRef {
  /** Canonical English book name, e.g. "1 Corinthians" */
  book: string;
  chapter: number;
  /** Verse ranges in `chapter`; null = whole chapter */
  ranges: Array<[number, number]> | null;
  /** For cross-chapter ranges (Genesis 1:1–2:3) */
  endChapter?: number;
  endVerse?: number;
}

export interface FoundRef {
  start: number;
  end: number;
  /** Exact text as it appeared in the source */
  text: string;
  ref: ScriptureRef;
}

/* ------------------------------------------------------------------ */
/* Book aliases                                                        */
/* ------------------------------------------------------------------ */

const VERSE_COUNTS: Record<string, number[]> = Object.fromEntries(
  BIBLE_META_WITH_VERSE_COUNTS.map((b: { name: string; chapters: number[] }) => [
    b.name,
    b.chapters,
  ])
);

// Base names (without number prefix) → extra spellings / abbreviations.
const ENGLISH_ALIASES: Record<string, string[]> = {
  Genesis: ["Gen", "Gn", "Ge"],
  Exodus: ["Exod", "Exo", "Ex"],
  Leviticus: ["Lev", "Lv"],
  Numbers: ["Num", "Nm", "Nb"],
  Deuteronomy: ["Deut", "Dt", "Deu"],
  Joshua: ["Josh", "Jos"],
  Judges: ["Judg", "Jdg"],
  Ruth: ["Rth", "Ru"],
  Samuel: ["Sam", "Sm"],
  Kings: ["Kgs", "Kin", "Ki"],
  Chronicles: ["Chron", "Chr"],
  Ezra: ["Ezr"],
  Nehemiah: ["Neh"],
  Esther: ["Esth", "Est"],
  Job: [],
  Psalms: ["Psalm", "Pss", "Psa", "Ps"],
  Proverbs: ["Prov", "Pro", "Prv", "Pr"],
  Ecclesiastes: ["Eccles", "Eccl", "Ecc", "Qoheleth"],
  "Song of Solomon": ["Song of Songs", "Song of Sol", "Song", "Canticles", "SOS"],
  Isaiah: ["Isa", "Is"],
  Jeremiah: ["Jer", "Jr"],
  Lamentations: ["Lam"],
  Ezekiel: ["Ezek", "Eze", "Ezk"],
  Daniel: ["Dan", "Dn"],
  Hosea: ["Hos"],
  Joel: ["Jl"],
  Amos: ["Am"],
  Obadiah: ["Obad", "Ob"],
  Jonah: ["Jon"],
  Micah: ["Mic"],
  Nahum: ["Nah"],
  Habakkuk: ["Hab"],
  Zephaniah: ["Zeph", "Zep"],
  Haggai: ["Hag"],
  Zechariah: ["Zech", "Zec"],
  Malachi: ["Mal"],
  Matthew: ["Matt", "Mat", "Mt"],
  Mark: ["Mrk", "Mk"],
  Luke: ["Luk", "Lk"],
  John: ["Jhn", "Jn"],
  Acts: ["Act"],
  Romans: ["Rom", "Rm"],
  Corinthians: ["Cor", "Co"],
  Galatians: ["Gal"],
  Ephesians: ["Eph"],
  Philippians: ["Phil", "Php"],
  Colossians: ["Col"],
  Thessalonians: ["Thess", "Thes", "Th"],
  Timothy: ["Tim", "Ti"],
  Titus: ["Tit"],
  Philemon: ["Philem", "Phlm", "Phm"],
  Hebrews: ["Heb"],
  James: ["Jas", "Jm"],
  Peter: ["Pet", "Pt"],
  Jude: ["Jud"],
  Revelation: ["Revelations", "Rev", "Rv", "Apocalypse"],
};

const NUMBER_PREFIXES: Record<string, string[]> = {
  "1": ["1", "1st", "First", "I"],
  "2": ["2", "2nd", "Second", "II"],
  "3": ["3", "3rd", "Third", "III"],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** alias (lower-cased, single-spaced) → canonical English name */
const ALIAS_TO_BOOK = new Map<string, string>();
/** Aliases that are full book names (safe for chapter-only references) */
const FULL_NAME_ALIASES = new Set<string>();

const aliasKey = (alias: string) =>
  alias.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

function addAlias(alias: string, book: string, fullName = false) {
  const key = aliasKey(alias);
  if (!ALIAS_TO_BOOK.has(key)) ALIAS_TO_BOOK.set(key, book);
  if (fullName) FULL_NAME_ALIASES.add(key.replace(/\s+/g, ""));
}

const FULL_BASE_NAMES = new Set(["Psalm", "Song of Songs", "Revelations"]);

for (const book of Object.keys(VERSE_COUNTS)) {
  const numbered = book.match(/^([1-3]) (.+)$/);
  const base = numbered ? numbered[2] : book;
  const names = [base, ...(ENGLISH_ALIASES[base] ?? [])];

  const isFull = (n: string) => n === base || FULL_BASE_NAMES.has(n);

  if (numbered) {
    for (const prefix of NUMBER_PREFIXES[numbered[1]]) {
      for (const n of names) {
        addAlias(`${prefix} ${n}`, book, isFull(n));
        if (/^\d/.test(prefix)) addAlias(`${prefix}${n}`, book, isFull(n)); // "1Cor"
      }
    }
  } else {
    for (const n of names) addAlias(n, book, isFull(n));
  }

  const telugu = TELUGU_BOOK_NAMES[book];
  if (telugu) {
    addAlias(telugu, book, true);
    const tm = telugu.match(/^([1-3])\s*(.+)$/);
    if (tm) {
      addAlias(`${tm[1]} ${tm[2]}`, book, true);
      addAlias(`${tm[1]}${tm[2]}`, book, true);
    }
  }
}

// Longest first so "1 John" wins over "John", "Song of Songs" over "Song".
const BOOK_ALTERNATION = [...ALIAS_TO_BOOK.keys()]
  .sort((a, b) => b.length - a.length)
  .map((a) => escapeRe(a).replace(/ /g, "\\s*"))
  .join("|");

export function resolveBook(raw: string): string | null {
  const key = aliasKey(raw);
  if (ALIAS_TO_BOOK.has(key)) return ALIAS_TO_BOOK.get(key)!;
  // "1Cor" / "1 Cor" spacing variants
  const spaced = key.replace(/^([1-3])\s*/, "$1 ");
  if (ALIAS_TO_BOOK.has(spaced)) return ALIAS_TO_BOOK.get(spaced)!;
  const unspaced = key.replace(/^([1-3])\s+/, "$1");
  return ALIAS_TO_BOOK.get(unspaced) ?? null;
}

/* ------------------------------------------------------------------ */
/* Regex                                                               */
/* ------------------------------------------------------------------ */

const DASH = "\\s*[-‐‑‒–—―]\\s*";
const NUM = "\\d{1,3}";
// A list item ("3:16, 18") must not be a chapter ("…, 4:2") or the number
// prefix of the next book ("…, 1 Corinthians", "…, 1st John", "…, 2 యోహాను").
const LIST_END = "(?!\\s*:|(?:st|nd|rd)?\\s*[\\p{Lu}\\u0C00-\\u0C7F])";

// chapter, then optional :verse [–verse | –chapter:verse] [, verse[–verse]]*
const CV =
  `(${NUM})` +
  `(?:\\s*[:.]\\s*(${NUM})` +
  `(?:${DASH}(${NUM})(?:\\s*:\\s*(${NUM}))?)?` +
  `((?:\\s*,\\s*${NUM}(?:${DASH}${NUM})?${LIST_END})*)` +
  `)?`;

// Book (with optional trailing dot) followed by chapter[:verse...]
const FULL_REF_SOURCE =
  `(?<![\\p{L}\\p{N}])(${BOOK_ALTERNATION})\\.?\\s*(?:ch(?:apter)?\\.?\\s*)?${CV}(?![\\p{L}\\p{N}]|:\\d)`;

// Follow-on references after ";" or "," that inherit the previous book:
// "Romans 3:23; 6:23" → second part. Requires chapter:verse.
const FOLLOW_ON_SOURCE =
  `^(\\s*[;,]\\s*(?:and\\s+)?)(${NUM})\\s*:\\s*(${NUM})` +
  `(?:${DASH}(${NUM})(?:\\s*:\\s*(${NUM}))?)?` +
  `((?:\\s*,\\s*${NUM}(?:${DASH}${NUM})?${LIST_END})*)` +
  `(?![\\p{L}\\p{N}]|:\\d)`;

const FULL_REF_RE = new RegExp(FULL_REF_SOURCE, "giu");
const FOLLOW_ON_RE = new RegExp(FOLLOW_ON_SOURCE, "iu");

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function verseCount(book: string, chapter: number): number {
  return VERSE_COUNTS[book]?.[chapter - 1] ?? 0;
}

function buildRef(
  book: string,
  chapter: number,
  v1?: string,
  v2?: string,
  v2verse?: string,
  extra?: string
): ScriptureRef | null {
  const chapters = VERSE_COUNTS[book];
  if (!chapters || chapter < 1 || chapter > chapters.length) return null;

  if (!v1) return { book, chapter, ranges: null };

  const startVerse = Number(v1);
  const max = verseCount(book, chapter);
  if (startVerse < 1 || startVerse > max) return null;

  // Cross-chapter: 1:1–2:3  (v2 = end chapter, v2verse = end verse)
  if (v2 && v2verse) {
    const endChapter = Number(v2);
    const endVerse = Number(v2verse);
    if (endChapter <= chapter || endChapter > chapters.length) return null;
    return {
      book,
      chapter,
      ranges: [[startVerse, max]],
      endChapter,
      endVerse: Math.min(endVerse, verseCount(book, endChapter)),
    };
  }

  const ranges: Array<[number, number]> = [];
  const end = v2 ? Math.min(Number(v2), max) : startVerse;
  ranges.push([startVerse, Math.max(startVerse, end)]);

  if (extra) {
    for (const part of extra.split(",")) {
      const p = part.trim();
      if (!p) continue;
      const [a, b] = p.split(/[-‐‑‒–—―]/).map((s) => Number(s.trim()));
      if (!a || a > max) continue;
      ranges.push([a, Math.min(b && b >= a ? b : a, max)]);
    }
  }

  return { book, chapter, ranges };
}

/** Find every scripture reference in a piece of text. */
export function findScriptureRefs(text: string): FoundRef[] {
  if (!text) return [];
  const found: FoundRef[] = [];
  FULL_REF_RE.lastIndex = 0;

  let m: RegExpExecArray | null;
  while ((m = FULL_REF_RE.exec(text)) !== null) {
    const book = resolveBook(m[1]);
    if (!book) continue;

    // English book names must be capitalised ("is 2:5" is prose, not Isaiah).
    const nameOnly = m[1].replace(
      /^(?:[1-3](?:st|nd|rd)?|i{1,3}|first|second|third)\s*/i,
      ""
    );
    const firstLetter = nameOnly.match(/\p{L}/u)?.[0] ?? "";
    if (/[a-z]/.test(firstLetter)) continue;

    // A bare chapter ("John 3") only counts with a full book name, so
    // "Am 3" or "Is 5" in ordinary prose is not linked.
    if (!m[3] && !FULL_NAME_ALIASES.has(aliasKey(m[1]).replace(/\s+/g, ""))) {
      continue;
    }

    const ref = buildRef(book, Number(m[2]), m[3], m[4], m[5], m[6]);
    if (!ref) continue;

    let end = m.index + m[0].length;
    found.push({ start: m.index, end, text: m[0], ref });

    // Follow-on references inheriting the same book
    let rest = text.slice(end);
    let f: RegExpExecArray | null;
    while ((f = FOLLOW_ON_RE.exec(rest)) !== null) {
      const sepLen = f[1].length;
      const follow = buildRef(book, Number(f[2]), f[3], f[4], f[5], f[6]);
      if (!follow) break;
      const s = end + sepLen;
      const e = end + f[0].length;
      found.push({ start: s, end: e, text: text.slice(s, e), ref: follow });
      end = e;
      rest = text.slice(end);
    }
    FULL_REF_RE.lastIndex = end;
  }

  return found;
}

/** Parse a single reference string ("John 3:1–13"). */
export function parseScriptureRef(raw: string): ScriptureRef | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\(.*?\)/g, " ").replace(/^[\s•–\-]+/, "").trim();
  const hits = findScriptureRefs(cleaned);
  return hits.length ? hits[0].ref : null;
}

/** Human-readable label in English: "John 3:1–13", "Genesis 1:1–2:3". */
export function formatScriptureRef(ref: ScriptureRef, bookLabel = ref.book): string {
  const base = `${bookLabel} ${ref.chapter}`;
  if (!ref.ranges) return base;
  if (ref.endChapter) {
    return `${base}:${ref.ranges[0][0]}–${ref.endChapter}:${ref.endVerse}`;
  }
  return (
    base +
    ":" +
    ref.ranges.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ")
  );
}

/** Spoken form: "John chapter 3 verses 1 to 13". */
export function speakScriptureRef(ref: ScriptureRef, bookLabel = ref.book): string {
  const base = `${bookLabel} chapter ${ref.chapter}`;
  if (!ref.ranges) return base;
  if (ref.endChapter) {
    return `${base} verse ${ref.ranges[0][0]} to chapter ${ref.endChapter} verse ${ref.endVerse}`;
  }
  const [a, b] = ref.ranges[0];
  const first = a === b ? `verse ${a}` : `verses ${a} to ${b}`;
  const more = ref.ranges
    .slice(1)
    .map(([x, y]) => (x === y ? `${x}` : `${x} to ${y}`));
  return `${base} ${first}${more.length ? ", " + more.join(", ") : ""}`;
}

type ChapterLoader = (
  book: string,
  chapter: number,
  version: string
) => Promise<Array<{ verse: number; text: Record<string, string | undefined> }>>;

/**
 * Load the verse texts a reference covers.
 * Returns one line per verse, prefixed with its number (and chapter when the
 * reference spans chapters or covers a whole chapter).
 */
export async function loadScriptureRefText(
  ref: ScriptureRef,
  version: string,
  loadChapter: ChapterLoader
): Promise<string> {
  const pick = (t: Record<string, string | undefined>) =>
    t[version] || t.KJV || Object.values(t).find(Boolean) || "";

  const lines: string[] = [];

  const chapters: number[] = [ref.chapter];
  if (ref.endChapter) {
    for (let c = ref.chapter + 1; c <= ref.endChapter; c++) chapters.push(c);
  }

  for (const c of chapters) {
    const data = await loadChapter(ref.book, c, version);
    if (!data?.length) continue;

    let inRange: (v: number) => boolean;
    if (!ref.ranges) inRange = () => true;
    else if (ref.endChapter) {
      inRange =
        c === ref.chapter
          ? (v) => v >= ref.ranges![0][0]
          : c === ref.endChapter
          ? (v) => v <= (ref.endVerse ?? 0)
          : () => true;
    } else {
      inRange = (v) => ref.ranges!.some(([a, b]) => v >= a && v <= b);
    }

    const showChapter = chapters.length > 1;
    for (const v of data) {
      if (!inRange(v.verse)) continue;
      const text = pick(v.text);
      if (!text) continue;
      const label = showChapter ? `${c}:${v.verse}` : `${v.verse}`;
      lines.push(`${label} ${text}`);
    }
  }

  // A single verse reads better without its number
  if (lines.length === 1) return lines[0].replace(/^\S+\s/, "");
  return lines.join("\n");
}
