import { supabase } from "./supabaseClient";

/**
 * Fetch Hebrew interlinear rows for OT
 */
export async function fetchOTInterlinear(
  book: string,
  chapter: number,
  verse: number
) {
  const { data, error } = await supabase
    .from("ot_interlinear_words") // ⬅️ YOUR OT TABLE
    .select("*")
    .eq("book", book)
    .eq("chapter", chapter)
    .eq("verse", verse)
    .order("word_index");

  if (error) {
    console.error("fetchOTInterlinear failed", error);
    return [];
  }

  return data || [];
}
