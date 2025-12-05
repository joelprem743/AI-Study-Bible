// src/lib/noteService.ts
import { supabase } from "./supabaseClient";

export interface Note {
  id: string;
  user_id: string;
  book: string;
  chapter: number;
  verse: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface VerseKey {
  book: string;
  chapter: number;
  verse: number;
}

export function buildVerseKey(v: VerseKey) {
  return `${v.book}:${v.chapter}:${v.verse}`;
}

// ------------------------------------------------------------
// FETCH NOTE FOR ONE VERSE
// ------------------------------------------------------------
export async function getNoteForVerse(
  userId: string,
  verse: VerseKey
): Promise<Note | null> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .match({
      user_id: userId,
      book: verse.book,
      chapter: verse.chapter,
      verse: verse.verse,
    })
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

// ------------------------------------------------------------
// UPSERT NOTE (CREATE OR UPDATE)
// ------------------------------------------------------------
export async function upsertNoteForVerse(
  userId: string,
  verse: VerseKey,
  content: string
): Promise<Note> {
  const payload = {
    user_id: userId,
    book: verse.book,
    chapter: verse.chapter,
    verse: verse.verse,
    content,
  };

  const { data, error } = await supabase
    .from("notes")
    .upsert([payload], {
      onConflict: "user_id,book,chapter,verse",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Note;
}

// ------------------------------------------------------------
// GET ALL NOTES FOR A USER
// ------------------------------------------------------------
export async function getAllNotesForUser(userId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ------------------------------------------------------------
// DELETE NOTE
// ------------------------------------------------------------
export async function deleteNoteById(id: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}
