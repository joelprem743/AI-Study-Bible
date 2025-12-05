// src/components/ProfileNotes.tsx
import { useState, useMemo, useEffect } from "react";
import { useNotes } from "../context/NotesContext";
import type { Note } from "../lib/noteService";

interface Props {
  userId: string;
  onClose: () => void;
}

export default function ProfileNotes({ userId, onClose }: Props) {
  const { notesByKey, loading, deleteNote, refreshNoteFor } = useNotes();
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Convert map -> array
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

  return (
    <div
  className="
    fixed inset-0 
    bg-black/30 dark:bg-black/60 
    backdrop-blur-sm 
    z-50 flex items-center justify-center
  "
  onClick={onClose}
>
  <div
    className="
      bg-white dark:bg-slate-900
      border border-gray-200 dark:border-slate-700
      w-full max-w-4xl max-h-[90vh]
      rounded-xl shadow-2xl overflow-hidden flex flex-col
    "
    onClick={(e) => e.stopPropagation()}
  >
    {/* Header */}
    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300 dark:border-slate-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        My Notes
      </h2>
      <button className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        onClick={onClose}>
        Close
      </button>
    </div>

    {/* Search */}
    <div className="px-5 py-3 border-b border-gray-300 dark:border-slate-700">
      <input
        className="
          w-full rounded-md 
          bg-gray-100 dark:bg-slate-800 
          border border-gray-300 dark:border-slate-700 
          px-3 py-2 text-sm
          text-gray-900 dark:text-gray-100
        "
        placeholder="Search by reference or content..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>

    <div className="flex flex-1 overflow-hidden">
      {/* Notes List */}
      <div className="w-1/2 overflow-y-auto border-r border-gray-300 dark:border-slate-700">
        {loading && (
          <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
            Loading notes...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
            No notes found.
          </div>
        )}

        {filtered.map((note) => (
          <button
            key={note.id}
            className={`w-full text-left px-5 py-3 border-b 
              border-gray-300 dark:border-slate-700 text-sm 
              bg-gray-50 dark:bg-slate-900
              hover:bg-gray-200 dark:hover:bg-slate-800
              ${
                selectedNote?.id === note.id
                  ? "bg-gray-200 dark:bg-slate-800"
                  : ""
              }
            `}
            onClick={() => setSelectedNote(note)}
          >
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {note.book} {note.chapter}:{note.verse}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {note.content || "(empty note)"}
            </div>
          </button>
        ))}
      </div>

      {/* Detail Panel */}
      <div className="w-1/2 flex flex-col bg-gray-50 dark:bg-slate-900">
        {!selectedNote ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 dark:text-gray-400 text-sm">
            Select a note to view it.
          </div>
        ) : (
          <>
            {/* Detail Header */}
            <div className="px-5 py-3 border-b border-gray-300 dark:border-slate-700 flex justify-between items-center">
              <div>
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  {selectedNote.book} {selectedNote.chapter}:{selectedNote.verse}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Updated: {new Date(selectedNote.updated_at).toLocaleString()}
                </div>
              </div>

              <button
                className="
                  px-3 py-1 text-xs rounded 
                  bg-red-600 hover:bg-red-700 
                  text-white
                "
                onClick={async () => {
                  const ok = window.confirm("Delete this note permanently?");
                  if (!ok) return;

                  await deleteNote(selectedNote.id);
                  setSelectedNote(null);
                }}
              >
                Delete
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {selectedNote.content}
            </div>
          </>
        )}
      </div>
    </div>
  </div>
</div>

  );
}
