import { useState, useCallback } from "react";

/**
 * Custom hook to persist a search query in sessionStorage for the duration of the browser session.
 * 
 * - Retains the query across internal navigation (e.g. viewing an item/bill detail and returning).
 * - Updates sessionStorage in real time as the user types.
 * - Cleans up sessionStorage when the search is cleared (or user deletes all text).
 * - Automatically discarded when the user closes the tab/session.
 */
export function usePersistentSearch(storageKey: string, initialDefault = "") {
  const [query, setQueryState] = useState<string>(() => {
    if (typeof window === "undefined") return initialDefault;
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved !== null && saved !== "") {
        return saved;
      }
    } catch {
      // ignore
    }
    return initialDefault;
  });

  const setQuery = useCallback(
    (valueOrFn: string | ((prev: string) => string)) => {
      setQueryState((prev) => {
        const next = typeof valueOrFn === "function" ? valueOrFn(prev) : valueOrFn;
        if (typeof window !== "undefined") {
          try {
            if (next && next.trim()) {
              window.sessionStorage.setItem(storageKey, next);
            } else {
              window.sessionStorage.removeItem(storageKey);
            }
          } catch {
            // ignore
          }
        }
        return next;
      });
    },
    [storageKey]
  );

  const clearQuery = useCallback(() => {
    setQuery("");
  }, [setQuery]);

  return [query, setQuery, clearQuery] as const;
}
