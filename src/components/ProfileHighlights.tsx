// src/components/ProfileHighlights.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchChapter } from "../services/bibleService";

interface HighlightRow {
  book: string;
  chapter: number;
  verse: number;
  color: string;
}

interface Props {
  userId: string;
  onClose: () => void;
}

export default function ProfileHighlights({ userId, onClose }: Props) {
  const [highlights, setHighlights] = useState<HighlightRow[]>([]);
  const [grouped, setGrouped] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHighlights();
  }, []);

  async function loadHighlights() {
    setLoading(true);

    const { data, error } = await supabase
      .from("highlights")
      .select("book, chapter, verse, color")
      .eq("user_id", userId)
      .order("book")
      .order("chapter")
      .order("verse");

    if (error) {
      console.error("Failed to load highlights", error);
      setLoading(false);
      return;
    }

    const groupedBooks: any = {};
    (data || []).forEach((h) => {
      if (!groupedBooks[h.book]) groupedBooks[h.book] = {};
      if (!groupedBooks[h.book][h.chapter]) groupedBooks[h.book][h.chapter] = [];
      groupedBooks[h.book][h.chapter].push(h);
    });

    setHighlights(data || []);
    setGrouped(groupedBooks);
    setLoading(false);
  }

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
          w-full max-w-2xl max-h-[85vh] overflow-y-auto
          bg-white dark:bg-slate-900
          border border-gray-200 dark:border-slate-700
          rounded-xl p-6 shadow-2xl
        "
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          My Highlights
        </h2>

        {loading ? (
          <div className="text-gray-700 dark:text-gray-300">Loading…</div>
        ) : highlights.length === 0 ? (
          <div className="text-gray-600 dark:text-gray-400">
            You have no highlights yet.
          </div>
        ) : (
          Object.keys(grouped).map((book) => (
            <div key={book} className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-blue-300 mb-2">
                {book}
              </h3>

              {Object.keys(grouped[book]).map((chapter) => (
                <div key={chapter} className="ml-4 mb-4">
                  <h4 className="text-sm text-gray-700 dark:text-gray-400 mb-1 font-medium">
                    Chapter {chapter}
                  </h4>

                  <div className="space-y-2">
                    {grouped[book][chapter].map((h: HighlightRow) => (
                      <HighlightItem
                        key={`${book}-${chapter}-${h.verse}`}
                        highlight={h}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        <button
          onClick={onClose}
          className="
            mt-4 px-4 py-2 text-sm
            bg-gray-200 hover:bg-gray-300
            dark:bg-slate-700 dark:hover:bg-slate-600
            text-gray-900 dark:text-gray-100
            rounded-md
          "
        >
          Close
        </button>
      </div>
    </div>
  );
}

interface ItemProps {
  highlight: HighlightRow;
  onClose: () => void;
}

const chapterCache: Record<string, any[]> = {};

function HighlightItem({ highlight, onClose }: ItemProps) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    loadText();
  }, []);

  async function loadText() {
    const key = `${highlight.book}-${highlight.chapter}`;

    if (!chapterCache[key]) {
      chapterCache[key] = await fetchChapter(highlight.book, highlight.chapter);
    }

    const verses = chapterCache[key];
    const verseObj = verses.find((v: any) => v.verse === highlight.verse);

    const english =
      verseObj?.text?.ESV ||
      verseObj?.text?.KJV ||
      verseObj?.text?.NIV ||
      "";

    const telugu = verseObj?.text?.BSI_TELUGU || "";

    setText(telugu || english);
  }

  const goToVerse = () => {
    window.location.hash = `#/${encodeURIComponent(
      highlight.book
    )}/${highlight.chapter}/${highlight.verse}`;
    onClose();
  };

  return (
    <button
      onClick={goToVerse}
      className="
        w-full text-left px-3 py-2 
        bg-gray-50 hover:bg-gray-200
        dark:bg-slate-800 dark:hover:bg-slate-700 
        rounded-md 
        border border-gray-300 dark:border-slate-700
        transition-colors
      "
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3 rounded"
          style={{ backgroundColor: highlight.color }}
        />
        <span className="font-semibold text-sm text-gray-800 dark:text-blue-200">
          {highlight.book} {highlight.chapter}:{highlight.verse}
        </span>
      </div>

      <p className="text-xs text-gray-700 dark:text-slate-300 truncate">
        {text}
      </p>
    </button>
  );
}
