import { useLocalStorage } from "./useLocalStorage";

export type FontSize = "sm" | "md" | "lg" | "xl";
export type ThemeMode = "system" | "light" | "dark";

export type ReaderSettings = {
  fontSize: FontSize;
  autoScrollSpeed: number;
  autoScrollIntervalMs: number;
  themeMode: ThemeMode;
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: "md",
  autoScrollSpeed: 1,
  autoScrollIntervalMs: 60,
  themeMode: "system",
};

export const useReaderSettings = () => {
  const [settings, setSettings] = useLocalStorage<ReaderSettings>(
    "readerSettings",
    DEFAULT_READER_SETTINGS
  );

  return { settings, setSettings };
};
