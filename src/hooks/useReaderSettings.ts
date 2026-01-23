import { useLocalStorage } from "./useLocalStorage";

export type FontSize = "sm" | "md" | "lg" | "xl";

export type ReaderSettings = {
  fontSize: FontSize;
  autoScrollSpeed: number;
  autoScrollIntervalMs: number;
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: "md",
  autoScrollSpeed: 1,
  autoScrollIntervalMs: 60,
};

export const useReaderSettings = () => {
  const [settings, setSettings] = useLocalStorage<ReaderSettings>(
    "readerSettings",
    DEFAULT_READER_SETTINGS
  );

  return { settings, setSettings };
};
