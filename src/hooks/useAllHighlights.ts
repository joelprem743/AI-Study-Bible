// src/hooks/useAllHighlights.ts
import { useEffect, useState } from "react";
import { getAllHighlights } from "../lib/highlightService";

export function useAllHighlights(userId?: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getAllHighlights(userId)
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load highlights");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  return { items, loading, error };
}
