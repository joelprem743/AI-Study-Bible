// src/components/ProfileNotes.tsx
import { useState, useMemo } from "react";
import { useNotes } from "../context/NotesContext";
import type { Note } from "../lib/noteService";

interface Props {
  userId: string;
  onClose: () => void;
}

export default function ProfileNotes({ onClose }: Props) {
  const { notesByKey, loading, deleteNote } = useNotes();
  const [search, setSearch] = useState("");

  const notes = useMemo(() => Object.values(notesByKey), [notesByKey]);

  // Filter notes
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return notes;

    return notes.filter((n) => {
      const ref = `${n.book} ${n.chapter}:${n.verse}`.toLowerCase();
      return (
        ref.includes(term) || (n.content ?? "").toLowerCase().includes(term)
      );
    });
  }, [notes, search]);

  // Group: Book → Chapter → Notes[]
  const grouped = useMemo(() => {
    const obj: Record<string, Record<number, Note[]>> = {};

    for (const n of filtered) {
      if (!obj[n.book]) obj[n.book] = {};
      if (!obj[n.book][n.chapter]) obj[n.book][n.chapter] = [];
      obj[n.book][n.chapter].push(n);
    }

    return obj;
  }, [filtered]);

  const goToNote = (note: Note) => {
    window.location.hash = `#/${encodeURIComponent(
      note.book
    )}/${note.chapter}/${note.verse}`;
    onClose();
  };

  return (
    <div
      className="
        fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm 
        z-50 flex items-center justify-center
      "
      onClick={onClose}
    >
      <div
        className="
          bg-white dark:bg-slate-900 
          border border-gray-200 dark:border-slate-700
          w-full max-w-2xl max-h-[85vh]
          rounded-xl shadow-2xl overflow-hidden flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            My Notes
          </h2>
          <button
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-300 dark:border-slate-700">
          <input
            className="
              w-full rounded-md bg-gray-100 dark:bg-slate-800 
              border border-gray-300 dark:border-slate-700 
              px-3 py-2 text-sm
              text-gray-900 dark:text-gray-100
            "
            placeholder="Search by reference or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
              Loading notes...
            </div>
          )}

          {!loading && notes.length === 0 && (
            <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
              You have no notes.
            </div>
          )}

          {/* Grouped Books */}
          {!loading &&
            Object.keys(grouped).map((book) => (
              <div key={book} className="px-5 py-3">
                {/* Book Title */}
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
                  {book}
                </h3>

                {/* Chapters */}
                {Object.keys(grouped[book]).map((chapter) => (
                  <div key={chapter} className="ml-3 mb-4">
                    <h4 className="text-sm text-gray-700 dark:text-gray-400 mb-1 font-semibold">
                      Chapter {chapter}
                    </h4>

                    {/* Notes inside chapter */}
                    <div className="space-y-2">
                      {grouped[book][Number(chapter)].map((note) => (
                        <div
                        key={note.id}
                        className="
                          flex items-center justify-between
                          px-5 py-2 border-b
                          border-gray-300 dark:border-slate-700
                          bg-gray-50 dark:bg-slate-900
                          hover:bg-gray-200 dark:hover:bg-slate-800
                          cursor-pointer
                        "
                        onClick={() => goToNote(note)}
                      >
                      
                        {/* Left: 16:2 — my note text */}
                        <div className="flex-1 overflow-hidden">
                          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                            {chapter}:{note.verse}
                          </span>

                          <span className="text-sm text-gray-700 dark:text-gray-300 ml-1 truncate">
                            - {note.content || "(empty note)"}
                          </span>

                        </div>

                      
                        {/* Right: Delete button */}
                        <button
                          className="
                            ml-3 px-3 py-1 text-xs rounded 
                            bg-red-600 hover:bg-red-700 text-white
                          "
                          onClick={(e) => {
                            e.stopPropagation();
                            const ok = window.confirm("Delete this note?");
                            if (ok) deleteNote(note.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                      
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
