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

function resolveOTBookCode(book: string): string | null {
  if (!book) return null;

  const cleaned = book.replace(/\.$/, "").trim();

  if (OT_BOOK_CODE_MAP[cleaned]) {
    return OT_BOOK_CODE_MAP[cleaned];
  }

  // already DB-style code (Gen, Lev, etc.)
  if (/^[1-3]?[A-Z][a-z]{1,3}$/.test(cleaned)) {
    return cleaned;
  }

  console.warn("UNRESOLVED OT BOOK:", book);
  return null;
}

// src/lib/interlinearServiceOT.ts
export async function fetchOTInterlinear(
  bookName: string,
  chapter: number,
  verse: number
) {
  const bookCode = resolveOTBookCode(bookName);

  if (!bookCode) {
    console.error("OT book not mapped:", bookName);
    return [];
  }

  const { data, error } = await supabase
    .from("interlinear_words")
    .select(`
      word_index,
      surface,
      morph_code,
      lemma_raw,
      lemma_norm,
      lemma_canon,
      strong
    `)
    .eq("testament", "OT")
    .eq("book", bookCode)
    .eq("chapter", chapter)
    .eq("verse", verse)
    .order("word_index");

  if (error) {
    console.error("OT interlinear fetch error:", {
      bookName,
      bookCode,
      chapter,
      verse,
      error,
    });
    return [];
  }

  return data ?? [];
}
