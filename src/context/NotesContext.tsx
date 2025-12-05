    // src/context/NotesContext.tsx
    import React, {
        createContext,
        useCallback,
        useContext,
        useEffect,
        useState,
        useMemo,
    } from "react";
    
    import {
        Note,
        VerseKey,
        buildVerseKey,
        getAllNotesForUser,
        getNoteForVerse,
        upsertNoteForVerse,
        deleteNoteById,
    } from "../lib/noteService";

    interface NotesContextValue {
        notesByKey: Record<string, Note>;
        getNoteFor: (v: VerseKey) => Note | null;
        refreshNoteFor: (v: VerseKey) => Promise<Note | null>;
        saveNoteFor: (v: VerseKey, content: string) => Promise<Note>;
        deleteNote: (id: string) => Promise<void>;
        loading: boolean;
    }
    console.log("Loaded NotesContext:", import.meta.url);

    const NotesContext = createContext<NotesContextValue | undefined>(undefined);
    
    export function NotesProvider({
        userId,
        children,
    }: {
        userId: string | null;
        children: React.ReactNode;
    }) {
        const [notesByKey, setNotes] = useState<Record<string, Note>>({});
        const [loading, setLoading] = useState(false);
    
        useEffect(() => {
        if (!userId) {
            setNotes({});
            return;
        }
    
        async function load() {
            setLoading(true);
            const notes = await getAllNotesForUser(userId);
            const map: Record<string, Note> = {};
            for (const n of notes) {
            const k = buildVerseKey(n);
            map[k] = n;
            }
            setNotes(map);
            setLoading(false);
        }
    
        load();
        }, [userId]);
    
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
    
        const value = useMemo(
        () => ({
            notesByKey,
            getNoteFor,
            refreshNoteFor,
            saveNoteFor,
            deleteNote,
            loading,
        }),
        [notesByKey, getNoteFor, refreshNoteFor, saveNoteFor, deleteNote, loading]
        );
    
        return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
    }
    
    export function useNotes() {
        const ctx = useContext(NotesContext);
        if (!ctx) throw new Error("useNotes must be inside NotesProvider");
        return ctx;
    }
    