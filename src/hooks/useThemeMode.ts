//src/hooks/useThemeMode.ts
import { useEffect } from "react";
import type { ThemeMode } from "./useReaderSettings";

export function useThemeMode(themeMode: ThemeMode) {


  useEffect(() => {
    const root = document.documentElement; // <html>

    const apply = () => {
      if (themeMode === "dark") {
        root.classList.add("dark");
        return;
      }

      if (themeMode === "light") {
        root.classList.remove("dark");
        return;
      }

      // system
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.classList.add("dark");
      else root.classList.remove("dark");
    };

    apply();

    // if system mode, listen for OS theme change
    let mq: MediaQueryList | null = null;
    const onChange = () => apply();

    if (themeMode === "system") {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onChange);
    }

    return () => {
      if (mq) mq.removeEventListener("change", onChange);
    };
  }, [themeMode]);
}
