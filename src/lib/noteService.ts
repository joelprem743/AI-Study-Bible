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
// -----------------------
// Topical Notes Section
// -----------------------

export interface TopicalNote {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

function mapTopicalRow(d: any): TopicalNote {
  return {
    id: d.id,
    userId: d.user_id,
    title: d.title,
    body: d.body,
    createdAt: new Date(d.created_at).getTime(),
    updatedAt: new Date(d.updated_at).getTime()
  };
}

export async function getAllTopicalNotes(userId: string): Promise<TopicalNote[]> {
  const { data, error } = await supabase
    .from("topical_notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapTopicalRow);
}

export async function createTopicalNote(
  userId: string,
  title: string,
  body: string
): Promise<TopicalNote> {
  const { data, error } = await supabase
    .from("topical_notes")
    .insert({ user_id: userId, title, body })
    .select()
    .single();

  if (error) throw error;
  return mapTopicalRow(data);
}

export async function updateTopicalNote(
  id: string,
  title: string,
  body: string
): Promise<TopicalNote> {
  const { data, error } = await supabase
    .from("topical_notes")
    .update({ title, body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapTopicalRow(data);
}

export async function deleteTopicalNoteById(id: string): Promise<void> {
  const { error } = await supabase
    .from("topical_notes")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
