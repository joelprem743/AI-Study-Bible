// src/lib/interlinearServiceOT.ts
import { supabase } from "./supabaseClient";

/**
 * OT English → DB book code mapping
 * MUST match interlinear_words.book exactly
 */
const OT_BOOK_CODE_MAP: Record<string, string> = {
  Genesis: "Gen",
  Exodus: "Exod",
  Leviticus: "Lev",
  Numbers: "Num",
  Deuteronomy: "Deut",
  Joshua: "Josh",
  Judges: "Judg",
  Ruth: "Ruth",
  "1 Samuel": "1Sam",
  "2 Samuel": "2Sam",
  "1 Kings": "1Kgs",
  "2 Kings": "2Kgs",
  "1 Chronicles": "1Chr",
  "2 Chronicles": "2Chr",
  Ezra: "Ezra",
  Nehemiah: "Neh",
  Esther: "Esth",
  Job: "Job",
  Psalms: "Ps",
  Proverbs: "Prov",
  Ecclesiastes: "Eccl",
  "Song of Solomon": "Song",
  Isaiah: "Isa",
  Jeremiah: "Jer",
  Lamentations: "Lam",
  Ezekiel: "Ezek",
  Daniel: "Dan",
  Hosea: "Hos",
  Joel: "Joel",
  Amos: "Amos",
  Obadiah: "Obad",
  Jonah: "Jonah",
  Micah: "Mic",
  Nahum: "Nah",
  Habakkuk: "Hab",
  Zephaniah: "Zeph",
  Haggai: "Hag",
  Zechariah: "Zech",
  Malachi: "Mal",
};

/**
 * Resolve incoming book name to DB book code
 */
function resolveOTBookCode(book: string): string | null {
  if (!book) return null;

  const cleaned = book.replace(/\.$/, "").trim();

  // English → DB code
  if (OT_BOOK_CODE_MAP[cleaned]) {
    return OT_BOOK_CODE_MAP[cleaned];
  }

  // Already DB-style (Gen, Lev, etc.)
  if (/^[1-3]?[A-Z][a-z]{1,3}$/.test(cleaned)) {
    return cleaned;
  }

  console.warn("UNRESOLVED OT BOOK:", book);
  return null;
}

/**
 * Fetch OT interlinear words for a verse
 * RETURNS: interlinear_words[]
 */
export async function fetchOTInterlinear(
  book: string,
  chapter: number,
  verse: number
) {
  const bookCode = resolveOTBookCode(book);
  if (!bookCode) return [];

  const { data, error } = await supabase
    .from("interlinear_words")
    .select("*")
    .eq("testament", "OT")
    .eq("book", bookCode)
    .eq("chapter", chapter)
    .eq("verse", verse)
    .order("word_index");

  if (error) {
    console.error(
      "OT interlinear fetch failed:",
      { book, chapter, verse },
      error
    );
    return [];
  }

  return data ?? [];
}

/**
 * Fetch Strong's lexicon entry
 * RETURNS: strong_lexicon row
 */
export async function fetchStrongLexicon(strong: string) {
  if (!strong) return null;

  const { data, error } = await supabase
    .from("strong_lexicon_he")
    .select(`
      strong,
      lemma,
      transliteration,
      gloss,
      definition
    `)
    .eq("strong", strong)
    .single(); // <-- use single, not maybeSingle

  if (error) {
    console.error("Strong lexicon fetch failed:", strong, error);
    return null;
  }

  return data;
}
