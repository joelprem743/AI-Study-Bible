// src/hooks/useHighlights.ts
import { useEffect, useState, useCallback, useRef } from "react";
import {
  getHighlights,
  upsertHighlight,
  deleteHighlight,
} from "../lib/highlightService";

export type HighlightsMap = { [verse: number]: string };

export function useHighlights(
  userId: string | undefined,
  book: string,
  chapter: number
) {
  const [highlights, setHighlights] = useState<HighlightsMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track latest request to prevent race conditions
  const requestIdRef = useRef(0);

  // Load highlights when user / book / chapter changes
  useEffect(() => {
    if (!userId) {
      setHighlights({});
      return;
    }

    let cancelled = false;
    const currentReqId = ++requestIdRef.current;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const rows = await getHighlights(userId, book, chapter);
        if (cancelled || currentReqId !== requestIdRef.current) return;

        const map: HighlightsMap = {};
        for (const r of rows) {
          map[r.verse] = r.color;
        }

        setHighlights(map);
      } catch (err: any) {
        if (!cancelled) {
          console.error(err);
          setError(err.message || "Failed to load highlights");
        }
      } finally {
        if (!cancelled && currentReqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, book, chapter]);

  // Toggle highlight – ALWAYS use latest state
  const toggleHighlight = useCallback(
    async (verse: number, color: string | null) => {
      if (!userId) {
        console.warn("toggleHighlight called with no user. Ignored.");
        return;
      }

      setHighlights((prev) => {
        // OPTIMISTIC UI updates
        const current = prev[verse];

        if (!color || current === color) {
          const updated = { ...prev };
          delete updated[verse];
          // perform DB op async after setState
          deleteHighlight(userId, book, chapter, verse).catch(console.error);
          return updated;
        }

        const updated = { ...prev, [verse]: color };
        // async DB update
        upsertHighlight(userId, book, chapter, verse, color).catch(console.error);
        return updated;
      });
    },
    [userId, book, chapter]
  );

  return { highlights, loading, error, toggleHighlight };
}
