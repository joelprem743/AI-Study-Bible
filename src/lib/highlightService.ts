// src/lib/highlightService.ts
import { supabase } from "./supabaseClient";

export interface HighlightRow {
  user_id: string;
  book: string;
  chapter: number;
  verse: number;
  color: string | null;
}

/* ============================================================
   FETCH HIGHLIGHTS FOR A SPECIFIC BOOK + CHAPTER
============================================================ */
export async function getHighlights(
  userId: string,
  book: string,
  chapter: number
): Promise<HighlightRow[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("highlights")
    .select("*")
    .eq("user_id", userId)
    .eq("book", book)
    .eq("chapter", chapter)
    .order("verse");

  if (error) {
    console.error("getHighlights error:", error);
    return [];
  }

  return data ?? [];
}

/* ============================================================
   UPSERT (INSERT OR UPDATE) A HIGHLIGHT
   REQUIRED: userId, book, chapter, verse, color
============================================================ */
export async function upsertHighlight(
  userId: string,
  book: string,
  chapter: number,
  verse: number,
  color: string | null
) {
  const { data, error } = await supabase
    .from("highlights")
    .upsert(
      [
        {
          user_id: userId,
          book,
          chapter,
          verse,
          color,
        },
      ],
      {
        onConflict: "user_id,book,chapter,verse",
      }
    )
    .select("*");

  if (error) {
    console.error("upsertHighlight error:", error);
    throw error;
  }

  return data;
}

/* ============================================================
   DELETE A HIGHLIGHT COMPLETELY
============================================================ */
export async function deleteHighlight(
  userId: string,
  book: string,
  chapter: number,
  verse: number
) {
  if (!userId) throw new Error("Missing userId");

  const { error } = await supabase
    .from("highlights")
    .delete()
    .eq("user_id", userId)
    .eq("book", book)
    .eq("chapter", chapter)
    .eq("verse", verse);

  if (error) {
    console.error("deleteHighlight error:", error);
    throw error;
  }
}

/* ============================================================
   GET ALL HIGHLIGHTS FOR PROFILE PAGE
============================================================ */
export async function getAllHighlights(userId: string) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("highlights")
    .select("*")
    .eq("user_id", userId)
    .order("book", { ascending: true })
    .order("chapter", { ascending: true })
    .order("verse", { ascending: true });

  if (error) {
    console.error("getAllHighlights error:", error);
    return [];
  }

  return data ?? [];
}
