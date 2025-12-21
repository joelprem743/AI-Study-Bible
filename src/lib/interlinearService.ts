// src/lib/interlinearService.ts
import { supabase } from "./supabaseClient";
const NT_BOOK_NUMBER_MAP: Record<string, number> = {
    Matthew: 40,
    Mark: 41,
    Luke: 42,
    John: 43,
    Acts: 44,
    Romans: 45,
    "1 Corinthians": 46,
    "2 Corinthians": 47,
    Galatians: 48,
    Ephesians: 49,
    Philippians: 50,
    Colossians: 51,
    "1 Thessalonians": 52,
    "2 Thessalonians": 53,
    "1 Timothy": 54,
    "2 Timothy": 55,
    Titus: 56,
    Philemon: 57,
    Hebrews: 58,
    James: 59,
    "1 Peter": 60,
    "2 Peter": 61,
    "1 John": 62,
    "2 John": 63,
    "3 John": 64,
    Jude: 65,
    Revelation: 66,
  };
  
  function resolveBookNumber(book: string): number | null {
    return NT_BOOK_NUMBER_MAP[book] ?? null;
  }
  
  export async function fetchNTInterlinear(
    bookName: string,
    chapter: number,
    verse: number
  ) {
    const bookNumber = resolveBookNumber(bookName);
  
    if (!bookNumber) {
      console.warn("No NT book mapping for:", bookName);
      return [];
    }
  
    const { data, error } = await supabase
      .from("nt_interlinear_with_strong")
      .select(
        "word_index, surface, lemma_norm, strong, definition"
      )
      .eq("book", bookNumber)
      .eq("chapter", chapter)
      .eq("verse", verse)
      .order("word_index");
  
    if (error) {
      console.error("Interlinear fetch error:", error);
      return [];
    }
  
    return data ?? [];
  }
  