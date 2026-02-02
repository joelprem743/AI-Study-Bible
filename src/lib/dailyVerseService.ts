// src/lib/dailyVerseService.ts
import { supabase } from "./supabaseClient";

export type DailyVerseRow = {
  day: string;
  book: string;
  chapter: number;
  verse: number;

  meaning_en: string | null;
  meaning_te: string | null;

  application_en: string | null;
  application_te: string | null;

  prayer_en: string | null;
  prayer_te: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export const getOrCreateDailyVerse = async (): Promise<DailyVerseRow> => {
  const day = todayISO();

  // 1) Fetch today's row
  const existing = await supabase
    .from("daily_verse")
    .select("*")
    .eq("day", day)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as DailyVerseRow;

  // 2) Pick random verse reference from ESV
  const picked = await supabase.rpc("pick_random_verse_ref", {
    p_books: [
      "Psalms",
      "Proverbs",
      "Matthew",
      "Mark",
      "Luke",
      "John",
      "Romans",
      "Philippians",
    ],
  });
  

  if (picked.error) throw picked.error;
  if (!picked.data || picked.data.length === 0) {
    throw new Error("Failed to pick daily verse reference");
  }

  const ref = picked.data[0] as { book: string; chapter: number; verse: number };

  // 3) Insert daily verse (same for all users)
  const inserted = await supabase
    .from("daily_verse")
    .upsert(
      {
        day,
        book: ref.book,
        chapter: ref.chapter,
        verse: ref.verse,
      },
      { onConflict: "day" }
    )
    .select("*")
    .single();

  if (inserted.error) throw inserted.error;

  return inserted.data as DailyVerseRow;
};

export const updateDailyVerse = async (
    day: string,
    patch: Partial<DailyVerseRow>
  ): Promise<DailyVerseRow> => {
    const res = await supabase
      .from("daily_verse")
      .update(patch)
      .eq("day", day)
      .select("*")
      .single();
  
    if (res.error) throw res.error;
    return res.data as DailyVerseRow;
  };
  