// src/components/ProfileNotes.tsx
import { useState, useMemo, useEffect } from "react";
import { useNotes } from "../context/NotesContext";
import type { Note, TopicalNote } from "../lib/noteService";

interface Props {
  userId: string;
  onClose: () => void;
}


export default function ProfileNotes({ userId, onClose }: Props) {

  const {
    notesByKey,
    topicalNotes,
    loading,
    deleteNote,
    createTopicalNote,
    updateTopicalNote,
    deleteTopicalNote,
  } = useNotes();

  const [activeTab, setActiveTab] = useState<"verse" | "topical">("verse");

  // Create new topical note
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  // Draft edit buffers for topical notes
  const [editBuffers, setEditBuffers] = useState<
    Record<string, { title: string; body: string; saving?: boolean }>
  >({});

  // Search for verse notes
  const [search, setSearch] = useState("");

  // Verse notes as array
  const verseNotes = useMemo(() => Object.values(notesByKey), [notesByKey]);

  // Filter verse notes
  const filteredVerseNotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return verseNotes;

    return verseNotes.filter((n) => {
      const ref = `${n.book} ${n.chapter}:${n.verse}`.toLowerCase();
      return (
        ref.includes(term) || (n.content ?? "").toLowerCase().includes(term)
      );
    });
  }, [verseNotes, search]);

  // Group verse notes: Book → Chapter → Notes[]
  const groupedVerseNotes = useMemo(() => {
    const obj: Record<string, Record<number, Note[]>> = {};
    for (const n of filteredVerseNotes) {
      if (!obj[n.book]) obj[n.book] = {};
      if (!obj[n.book][n.chapter]) obj[n.book][n.chapter] = [];
      obj[n.book][n.chapter].push(n);
    }
    return obj;
  }, [filteredVerseNotes]);

  // Sorted topical notes
  const topicalArray = useMemo(
    () =>
      Object.values(topicalNotes || {}).sort(
        (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
      ),
    [topicalNotes]
  );

  // Initialize edit buffers whenever topicalNotes changes
  useEffect(() => {
    const buf: Record<string, { title: string; body: string }> = {};
    for (const n of topicalArray) {
      buf[n.id] = { title: n.title ?? "", body: n.body ?? "" };
    }
    setEditBuffers((prev) => ({ ...buf, ...prev }));
  }, [topicalArray]);

  const goToVerseNote = (note: Note) => {
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

        {/* Tabs */}
        <div className="flex border-b border-gray-300 dark:border-slate-700">
          <button
            className={
              "flex-1 py-2 text-center text-sm font-medium " +
              (activeTab === "verse"
                ? "bg-gray-200 dark:bg-slate-800"
                : "bg-gray-100 dark:bg-slate-900")
            }
            onClick={() => setActiveTab("verse")}
          >
            Verse Notes
          </button>

          <button
            className={
              "flex-1 py-2 text-center text-sm font-medium " +
              (activeTab === "topical"
                ? "bg-gray-200 dark:bg-slate-800"
                : "bg-gray-100 dark:bg-slate-900")
            }
            onClick={() => setActiveTab("topical")}
          >
            My Notes
          </button>
        </div>

        {/* Search for Verse Notes */}
        {activeTab === "verse" && (
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
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {/* VERSE NOTES TAB */}
          {activeTab === "verse" && (
            <>
              {loading && (
                <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
                  Loading notes...
                </div>
              )}

              {!loading && verseNotes.length === 0 && (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  You have no verse notes.
                </div>
              )}

              {!loading &&
                Object.keys(groupedVerseNotes).map((book) => (
                  <div key={book} className="px-5 py-3">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
                      {book}
                    </h3>

                    {Object.keys(groupedVerseNotes[book]).map((chapter) => (
                      <div key={chapter} className="ml-3 mb-4">
                        <h4 className="text-sm text-gray-700 dark:text-gray-400 mb-1 font-semibold">
                          Chapter {chapter}
                        </h4>

                        <div className="space-y-2">
                          {groupedVerseNotes[book][Number(chapter)].map(
                            (note) => (
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
                                onClick={() => goToVerseNote(note)}
                              >
                                <div className="flex-1 overflow-hidden">
                                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                    {chapter}:{note.verse}
                                  </span>

                                  <span className="text-sm text-gray-700 dark:text-gray-300 ml-1 truncate">
                                    - {note.content || "(empty note)"}
                                  </span>
                                </div>

                                <button
                                  className="
                                    ml-3 px-3 py-1 text-xs rounded 
                                    bg-red-600 hover:bg-red-700 text-white
                                  "
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const ok = window.confirm(
                                      "Delete this note?"
                                    );
                                    if (ok) deleteNote(note.id);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </>
          )}

          {/* TOPICAL NOTES TAB */}
          {activeTab === "topical" && (
            <div className="p-4 space-y-4">
              {/* CREATE NEW NOTE */}
              <div className="bg-gray-100 dark:bg-slate-800 p-4 rounded-lg border dark:border-slate-700">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full mb-2 p-2 bg-white dark:bg-slate-900 rounded border dark:border-slate-700"
                />
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Write your note..."
                  className="w-full p-2 h-24 bg-white dark:bg-slate-900 rounded border dark:border-slate-700"
                />

                <button
                  className="
                    mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded
                  "
                  onClick={async () => {
                    if (!newTitle.trim())
                      return alert("Title is required.");
                    try {
                      const created = await createTopicalNote(
                        newTitle.trim(),
                        newBody
                      );
                      setNewTitle("");
                      setNewBody("");

                      // Add to edit buffer so user can edit immediately
                      setEditBuffers((prev) => ({
                        ...prev,
                        [created.id]: {
                          title: created.title,
                          body: created.body,
                        },
                      }));
                    } catch (err) {
                      console.error(err);
                      alert("Failed to create note.");
                    }
                  }}
                >
                  Add Note
                </button>
              </div>

              {/* NO NOTES */}
              {topicalArray.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No notes created yet.
                </p>
              )}

              {/* LIST TOPICAL NOTES */}
              {topicalArray.map((note) => {
                const buffer = editBuffers[note.id] ?? {
                  title: note.title,
                  body: note.body,
                };
                const saving = buffer.saving;

                return (
                  <div
                    key={note.id}
                    className="
                      p-3 rounded border bg-white dark:bg-slate-900 
                      border-gray-300 dark:border-slate-700 shadow-sm
                    "
                  >
                    {/* Title */}
                    <input
                      className="w-full font-bold text-lg bg-transparent border-none focus:outline-none mb-2"
                      value={buffer.title}
                      onChange={(e) =>
                        setEditBuffers((prev) => ({
                          ...prev,
                          [note.id]: {
                            ...buffer,
                            title: e.target.value,
                          },
                        }))
                      }
                      placeholder="Title"
                    />

                    {/* Body */}
                    <textarea
                      className="w-full mt-1 bg-transparent border-none focus:outline-none"
                      value={buffer.body}
                      rows={4}
                      onChange={(e) =>
                        setEditBuffers((prev) => ({
                          ...prev,
                          [note.id]: {
                            ...buffer,
                            body: e.target.value,
                          },
                        }))
                      }
                    />

                    {/* Buttons */}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                        disabled={saving}
                        onClick={async () => {
                          setEditBuffers((prev) => ({
                            ...prev,
                            [note.id]: { ...buffer, saving: true },
                          }));

                          try {
                            await updateTopicalNote(
                              note.id,
                              buffer.title.trim(),
                              buffer.body
                            );
                          } catch (err) {
                            console.error(err);
                            alert("Failed to save note.");
                          }

                          setEditBuffers((prev) => ({
                            ...prev,
                            [note.id]: {
                              title: buffer.title,
                              body: buffer.body,
                            },
                          }));
                        }}
                      >
                        Save
                      </button>

                      <button
                        className="px-3 py-1 text-sm bg-gray-300 hover:bg-gray-400 rounded"
                        onClick={() =>
                          setEditBuffers((prev) => ({
                            ...prev,
                            [note.id]: {
                              title: note.title,
                              body: note.body,
                            },
                          }))
                        }
                      >
                        Reset
                      </button>

                      <button
                        className="ml-auto px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                        onClick={() => {
                          const ok = window.confirm("Delete this note?");
                          if (!ok) return;

                          deleteTopicalNote(note.id);

                          setEditBuffers((prev) => {
                            const c = { ...prev };
                            delete c[note.id];
                            return c;
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
