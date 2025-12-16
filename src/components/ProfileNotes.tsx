// src/components/ProfileNotes.tsx
import { useState, useMemo,useEffect } from "react";
import { useNotes } from "../context/NotesContext";
import { useAuth } from "../context/AuthContext";
import type { Note } from "../lib/noteService";
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import { BIBLE_META_WITH_VERSE_COUNTS } from "../data/bibleMetaWithVerseCounts";


/* ---------------- Bible helpers ---------------- */

const BOOK_INDEX = new Map<string, number>();
BIBLE_META_WITH_VERSE_COUNTS.forEach((b, i) =>
  BOOK_INDEX.set(b.name, i)
);

function getTestament(book: string): "OLD" | "NEW" {
  const idx = BOOK_INDEX.get(book);
  return idx !== undefined && idx < 39 ? "OLD" : "NEW";
}
function sortBooksByBibleOrder(books: Record<string, any>) {
  return Object.keys(books).sort((a, b) => {
    const ia = BOOK_INDEX.get(a) ?? 999;
    const ib = BOOK_INDEX.get(b) ?? 999;
    return ia - ib;
  });
}


function getDisplayBookName(book: string, language: "EN" | "TE") {
  return language === "TE"
    ? TELUGU_BOOK_NAMES[book] || book
    : book;
}

/* ------------------------------------------------ */

interface Props {
  userId: string;
  onClose: () => void;
  incomingVerse?: {
    ref: {
      book: string;
      chapter: number;
      verse: number;
    };
    text: string;
  };
}

export default function ProfileNotes({ userId, onClose ,incomingVerse}: Props) {
  const { language } = useAuth();

  const {
    notesByKey,
    topicalNotes,
    loading,
    deleteNote,
    createTopicalNote,
    updateTopicalNote,
    deleteTopicalNote,
    appendVerseToTopicalNote, 
  } = useNotes();

  const [activeTab, setActiveTab] = useState<"verse" | "topical">("verse");

  /* ---------------- Verse notes ---------------- */

  const verseNotes = useMemo(() => Object.values(notesByKey), [notesByKey]);

  const groupedVerseNotes = useMemo(() => {
    const obj: {
      OLD: Record<string, Record<number, Note[]>>;
      NEW: Record<string, Record<number, Note[]>>;
    } = { OLD: {}, NEW: {} };

    for (const n of verseNotes) {
      const testament = getTestament(n.book);
      if (!obj[testament][n.book]) obj[testament][n.book] = {};
      if (!obj[testament][n.book][n.chapter])
        obj[testament][n.book][n.chapter] = [];
      obj[testament][n.book][n.chapter].push(n);
    }

    return obj;
  }, [verseNotes]);

  const goToVerseNote = (note: Note) => {
    window.location.hash = `#/${encodeURIComponent(
      note.book
    )}/${note.chapter}/${note.verse}`;
    onClose();
  };

  /* ---------------- Topical notes ---------------- */

  const [editorMode, setEditorMode] =
    useState<"view" | "edit" | "create">("view");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const topicalArray = useMemo(
    () =>
      Object.values(topicalNotes || {}).sort(
        (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
      ),
    [topicalNotes]
  );
  const [expandedVerseKey, setExpandedVerseKey] = useState<string | null>(null);
  useEffect(() => {
    setExpandedVerseKey(null);
  }, [activeTab]);
  
  useEffect(() => {
    if (!incomingVerse) return;
  
    setActiveTab("topical");
    setEditorMode("view");
    setActiveNoteId(null);
  }, [incomingVerse]);
  
  /* ---------------- UI ---------------- */

  return (
    <div
      className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={() => {
        if (editorMode === "view") onClose();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">My Notes</h2>
          <button
            onClick={() => {
              if (editorMode === "view") onClose();
            }}
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 py-2 ${
              activeTab === "verse" ? "bg-gray-200 dark:bg-slate-800" : ""
            }`}
            onClick={() => {
              if (editorMode === "view") setActiveTab("verse");
            }}
          >
            Verse Notes
          </button>
          <button
            className={`flex-1 py-2 ${
              activeTab === "topical" ? "bg-gray-200 dark:bg-slate-800" : ""
            }`}
            onClick={() => {
              if (editorMode === "view") setActiveTab("topical");
            }}
          >
            My Notes
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ================= VERSE NOTES ================= */}
          {activeTab === "verse" && !loading && (
            <>
              {(["OLD", "NEW"] as const).map((testament) => {
                const books = groupedVerseNotes[testament];
                if (!books || Object.keys(books).length === 0) return null;

                return (
                  <div key={testament} className="px-4 py-6">
                    <div className="mb-4 px-3 py-2 bg-gray-100 dark:bg-slate-800/60 border-l-4 border-indigo-500 text-xs font-bold uppercase">
                      {language === "TE"
                        ? testament === "OLD"
                          ? "పాత నిబంధన"
                          : "క్రొత్త నిబంధన"
                        : testament === "OLD"
                        ? "Old Testament"
                        : "New Testament"}
                    </div>

                    {sortBooksByBibleOrder(books).map((book) => (

                      <div key={book} className="mb-5">
                        <h3 className="text-lg font-semibold">
                          {getDisplayBookName(book, language)}
                        </h3>

                        {Object.keys(books[book])
  .sort((a, b) => Number(a) - Number(b))
  .map((chapter) => (

                          <div key={chapter} className="ml-4 mt-2">
                            <div className="text-sm opacity-70">
                              {language === "TE" ? "అధ్యాయం" : "Chapter"}{" "}
                              {chapter}
                            </div>

                            {books[book][Number(chapter)].map((note) => {
  const key = `${note.book}-${note.chapter}-${note.verse}-${note.id}`;
  const isOpen = expandedVerseKey === key;

  return (
    <div
      key={note.id}
      className="
        rounded-xl
        border border-gray-200 dark:border-slate-700
        p-3 mt-2
        bg-white dark:bg-slate-800
        shadow-sm
        hover:shadow-md
        transition
      "
    >
      {/* Header (collapsed view) */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() =>
          setExpandedVerseKey(isOpen ? null : key)
        }
      >
       <div className="text-sm font-medium">
  {chapter}:{note.verse}
  <span className="ml-2 text-xs text-gray-400">
    {note.content?.slice(0, 40)}
    {note.content && note.content.length > 40 ? "…" : ""}
  </span>
</div>

        <div className="text-xs text-gray-400">
          {isOpen ? "Hide" : "View"}
        </div>
      </div>

      {/* Expanded content */}
      {isOpen && (
        <div className="mt-2 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
            {note.content || "(empty)"}
          </p>

          <div className="flex items-center gap-3 text-sm">
          <button
  className="text-blue-600 hover:underline"
  onClick={() => goToVerseNote(note)}
>
  Go to verse
</button>


            <button
              className="text-red-600 hover:underline ml-auto"
              onClick={() => {
                if (window.confirm("Delete this note?")) {
                  deleteNote(note.id);
                  setExpandedVerseKey(null);
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
})}

                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}

{activeTab === "topical" && editorMode === "view" && (
  <>
    {incomingVerse && (
      <div
        className="
          mx-4 mt-4 mb-2 px-3 py-2
          rounded-md
          bg-blue-50 dark:bg-slate-800
          text-xs
          text-blue-700 dark:text-blue-300
        "
      >
        Adding verse:
        <strong className="ml-1">
          {incomingVerse.ref.book}{" "}
          {incomingVerse.ref.chapter}:{incomingVerse.ref.verse}
        </strong>
      </div>
    )}

    <div className="p-4 grid gap-4">
      {topicalArray.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          No notes yet. Tap + to create one.
        </div>
      )}

{topicalArray.map((note) => (
  <button
    key={note.id}
    className="
      w-full text-left p-3 rounded-lg border
      hover:bg-gray-100 dark:hover:bg-slate-800
    "
    onClick={async () => {
      if (!incomingVerse) return;

      await appendVerseToTopicalNote(
        note.id,
        incomingVerse.ref,
        incomingVerse.text
      );

      onClose();
    }}
  >
    <div className="font-semibold">{note.title}</div>
    <div className="text-xs text-gray-500 truncate">
      {note.body?.slice(0, 80)}
    </div>
  </button>
))}

    </div>
  </>
)}



          {/* ================= TOPICAL NOTES (EDITOR) ================= */}
          {activeTab === "topical" && editorMode !== "view" && (
            <div className="p-4 flex flex-col h-full">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
  {editorMode === "create" ? "New Note" : "Edit Note"}
</div>

              <input
                className="text-xl font-bold mb-3 bg-transparent border-b outline-none"
                placeholder="Title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
              />

              <textarea
                className="flex-1 resize-none bg-transparent outline-none"
                placeholder="Write your note..."
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
              />

<div className="mt-4 flex items-center gap-2">
  <button
    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition"
    onClick={async () => {
      if (!draftTitle.trim()) return;

      if (editorMode === "create") {
        await createTopicalNote(draftTitle.trim(), draftBody);
      } else if (activeNoteId) {
        await updateTopicalNote(activeNoteId, draftTitle.trim(), draftBody);
      }

      setEditorMode("view");
      setActiveNoteId(null);
    }}
  >
    Save
  </button>

  <button
    className="px-4 py-2 border rounded text-gray-600 hover:text-gray-900 transition"
    onClick={() => {
      setEditorMode("view");
      setActiveNoteId(null);
    }}
  >
    Cancel
  </button>

  {editorMode === "edit" && activeNoteId && (
    <button
      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded transition ml-auto"
      onClick={async () => {
        if (window.confirm("Delete this note?")) {
          await deleteTopicalNote(activeNoteId);
          setEditorMode("view");
          setActiveNoteId(null);
        }
      }}
    >
      Delete
    </button>
  )}
</div>

            </div>
          )}
        </div>

        {/* Floating Add Button */}
        {/* Floating Add Button */}
{activeTab === "topical" && editorMode === "view" && (
  <button
  onClick={() => {
    if (incomingVerse) {
      setDraftTitle(
        `${incomingVerse.ref.book} ${incomingVerse.ref.chapter}:${incomingVerse.ref.verse}`
      );
      setDraftBody(
        `${incomingVerse.ref.book} ${incomingVerse.ref.chapter}:${incomingVerse.ref.verse}\n${incomingVerse.text}`
      );
    } else {
      setDraftTitle("");
      setDraftBody("");
    }
  
    setEditorMode("create");
  }}
  
    className="
      absolute bottom-6 right-6
      flex items-center gap-2
      px-5 py-3
      rounded-full
      bg-gradient-to-r from-blue-600 to-indigo-600
      text-white text-sm font-semibold
      shadow-lg
      hover:shadow-xl
      hover:scale-[1.03]
      active:scale-95
      transition-all
      z-50
    "
    aria-label="Create note"
  >
    <span className="text-xl leading-none">＋</span>
    <span className="hidden sm:inline">New Note</span>
  </button>
)}

      </div>
    </div>
  );
}
