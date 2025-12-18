// src/context/NotesContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { useAuth } from "./AuthContext";

import {
  Note,
  VerseKey,
  buildVerseKey,
  getAllNotesForUser,
  getNoteForVerse,
  upsertNoteForVerse,
  deleteNoteById,
  TopicalNote,
  getAllTopicalNotes,
  createTopicalNote,
  updateTopicalNote,
  deleteTopicalNoteById,
} from "../lib/noteService";

interface NotesContextValue {
  // Verse notes
  notesByKey: Record<string, Note>;
  getNoteFor: (v: VerseKey) => Note | null;
  refreshNoteFor: (v: VerseKey) => Promise<Note | null>;
  saveNoteFor: (v: VerseKey, content: string) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;

  // Topical notes
  topicalNotes: Record<string, TopicalNote>;
  createTopicalNote: (title: string, body: string) => Promise<TopicalNote>;
  updateTopicalNote: (
    id: string,
    title: string,
    body: string
  ) => Promise<TopicalNote>;
  deleteTopicalNote: (id: string) => Promise<void>;

  // ✅ NEW
  appendVerseToTopicalNote: (
    id: string,
    verseRef: VerseKey,
    verseText: string
  ) => Promise<void>;

  loading: boolean;
}

console.log("Loaded NotesContext:", import.meta.url);

const NotesContext = createContext<NotesContextValue | undefined>(undefined);

export function NotesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [notesByKey, setNotes] = useState<Record<string, Note>>({});
  const [topicalNotes, setTopicalNotes] =
    useState<Record<string, TopicalNote>>({});
  const [loading, setLoading] = useState(false);


  // ------------------------------------------------------------
  // LOAD notes (both verse notes & topical notes)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!userId) {
      setNotes({});
      setTopicalNotes({});
      return;
    }

    async function load() {
      setLoading(true);

      // Load verse notes
      const notes = await getAllNotesForUser(userId);
      const map: Record<string, Note> = {};
      for (const n of notes) {
        const k = buildVerseKey(n);
        map[k] = n;
      }
      setNotes(map);

      // Load topical notes
      const tnotes = await getAllTopicalNotes(userId);
      const tmap: Record<string, TopicalNote> = {};
      for (const t of tnotes) {
        tmap[t.id] = t;
      }
      setTopicalNotes(tmap);

      setLoading(false);
    }

    load();
  }, [userId]);

  // ------------------------------------------------------------
  // VERSE NOTES LOGIC
  // ------------------------------------------------------------
  const getNoteFor = useCallback(
    (v: VerseKey) => notesByKey[buildVerseKey(v)] ?? null,
    [notesByKey]
  );

  const refreshNoteFor = useCallback(
    async (v: VerseKey) => {
      if (!userId) return null;

      const note = await getNoteForVerse(userId, v);
      const key = buildVerseKey(v);

      setNotes((prev) => {
        const copy = { ...prev };
        if (note) copy[key] = note;
        else delete copy[key];
        return copy;
      });

      return note;
    },
    [userId]
  );

  const saveNoteFor = useCallback(
    async (v: VerseKey, content: string) => {
      if (!userId) throw new Error("Not logged in");

      const note = await upsertNoteForVerse(userId, v, content);
      const key = buildVerseKey(v);

      setNotes((prev) => ({ ...prev, [key]: note }));
      return note;
    },
    [userId]
  );

  const deleteNote = useCallback(async (id: string) => {
    await deleteNoteById(id);

    setNotes((prev) => {
      const copy = { ...prev };
      for (const k of Object.keys(copy)) {
        if (copy[k].id === id) delete copy[k];
      }
      return copy;
    });
  }, []);

  // ------------------------------------------------------------
  // TOPICAL NOTES CRUD
  // ------------------------------------------------------------
  const createTopical = useCallback(
    async (title: string, body: string) => {
      if (!userId) throw new Error("Not logged in");

      const note = await createTopicalNote(userId, title, body);
      setTopicalNotes((prev) => ({ ...prev, [note.id]: note }));
      return note;
    },
    [userId]
  );

  const updateTopical = useCallback(
    async (id: string, title: string, body: string) => {
      const note = await updateTopicalNote(id, title, body);
      setTopicalNotes((prev) => ({ ...prev, [note.id]: note }));
      return note;
    },
    []
  );

  const deleteTopical = useCallback(async (id: string) => {
    await deleteTopicalNoteById(id);
    setTopicalNotes((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  // ------------------------------------------------------------
  // ✅ APPEND VERSE TO TOPICAL NOTE
  // ------------------------------------------------------------
  const appendVerseToTopical = useCallback(
    async (id: string, verseRef: VerseKey, verseText: string) => {
      const note = topicalNotes[id];
      if (!note) return;

      const refLine = `${verseRef.book} ${verseRef.chapter}:${verseRef.verse}`;
      const block = `${refLine}\n${verseText}`;

      const body = note.body
        ? `${note.body}\n\n${block}`
        : block;

      const updated = await updateTopicalNote(id, note.title, body);

      setTopicalNotes((prev) => ({ ...prev, [updated.id]: updated }));
    },
    [topicalNotes]
  );

  // ------------------------------------------------------------
  // CONTEXT VALUE
  // ------------------------------------------------------------
  const value = useMemo(
    () => ({
      // verse notes
      notesByKey,
      getNoteFor,
      refreshNoteFor,
      saveNoteFor,
      deleteNote,

      // topical notes
      topicalNotes,
      createTopicalNote: createTopical,
      updateTopicalNote: updateTopical,
      deleteTopicalNote: deleteTopical,
      appendVerseToTopicalNote: appendVerseToTopical,

      loading,
    }),
    [
      notesByKey,
      topicalNotes,
      getNoteFor,
      refreshNoteFor,
      saveNoteFor,
      deleteNote,
      createTopical,
      updateTopical,
      deleteTopical,
      appendVerseToTopical,
      loading,
    ]
  );

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be inside NotesProvider");
  return ctx;
}
