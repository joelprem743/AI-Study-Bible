import { createContext, useContext, useRef } from "react";
import {
  fetchServerTts,
  hasBrowserTts,
  isServerTtsDown,
  langForText,
  speakWithBrowser,
  type BrowserSpeechHandle,
} from "../lib/speech";

type AudioItem = {
  text: string;
  lang: "EN" | "TE";
};

type AudioContextType = {
  /** Resolves when the item finished playing (or was stopped). */
  play: (item: AudioItem) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  preload: (item: AudioItem) => Promise<void>;
  subscribeProgress: (cb: (p: number, d: number) => void) => () => void;
};

/** Thrown by play() when stop() (or a newer play()) cancelled it. */
export class PlaybackCancelled extends Error {
  constructor() {
    super("Playback cancelled");
    this.name = "PlaybackCancelled";
  }
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = () => {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be inside AudioProvider");
  return ctx;
};

const CACHE_LIMIT = 80; // ≈ two chapters of verses

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browserSpeechRef = useRef<BrowserSpeechHandle | null>(null);

  // key → object URL. Map keeps insertion order, used as an LRU.
  const cacheRef = useRef<Map<string, string>>(new Map());
  const inflightRef = useRef<Map<string, Promise<string>>>(new Map());

  // Every play()/stop() bumps this; an older play() that wakes up after an
  // await sees the mismatch and bails out instead of starting audio.
  const tokenRef = useRef(0);
  const settleCurrentRef = useRef<(() => void) | null>(null);
  const isPausedRef = useRef(false);

  const listenersRef = useRef<((p: number, d: number) => void)[]>([]);
  const emitProgress = (p: number, d: number) =>
    listenersRef.current.forEach((cb) => cb(p, d));

  /* ---------------- cache ---------------- */

  const cacheGet = (key: string) => {
    const url = cacheRef.current.get(key);
    if (url) {
      // refresh LRU position
      cacheRef.current.delete(key);
      cacheRef.current.set(key, url);
    }
    return url;
  };

  const cacheSet = (key: string, url: string) => {
    cacheRef.current.set(key, url);
    while (cacheRef.current.size > CACHE_LIMIT) {
      const [oldKey, oldUrl] = cacheRef.current.entries().next().value as [string, string];
      // never revoke the clip that is playing right now
      if (audioRef.current?.src === oldUrl) break;
      cacheRef.current.delete(oldKey);
      URL.revokeObjectURL(oldUrl);
    }
  };

  /** Server audio URL for the text, from cache, in-flight request or network. */
  const getServerAudio = (text: string, lang: "EN" | "TE"): Promise<string> => {
    const key = `${lang}:${text}`;
    const cached = cacheGet(key);
    if (cached) return Promise.resolve(cached);

    const pending = inflightRef.current.get(key);
    if (pending) return pending;

    const p = fetchServerTts(text, lang)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        cacheSet(key, url);
        return url;
      })
      .finally(() => inflightRef.current.delete(key));

    inflightRef.current.set(key, p);
    return p;
  };

  /* ---------------- controls ---------------- */

  const subscribeProgress = (cb: (p: number, d: number) => void) => {
    listenersRef.current.push(cb);
    return () => {
      listenersRef.current = listenersRef.current.filter((l) => l !== cb);
    };
  };

  const haltCurrent = () => {
    if (audioRef.current) {
      const a = audioRef.current;
      a.onended = a.onerror = a.ontimeupdate = null;
      a.pause();
      audioRef.current = null;
    }
    browserSpeechRef.current?.cancel();
    browserSpeechRef.current = null;
    // let the awaiting play() return so the caller's loop can exit
    settleCurrentRef.current?.();
    settleCurrentRef.current = null;
    isPausedRef.current = false;
  };

  const play = async ({ text, lang: preferred }: AudioItem): Promise<void> => {
    haltCurrent();
    const token = ++tokenRef.current;
    const lang = langForText(text, preferred);

    let url: string | null = null;
    if (!isServerTtsDown()) {
      try {
        url = await getServerAudio(text, lang);
      } catch {
        url = null; // fall back to the browser voice below
      }
    }
    if (token !== tokenRef.current) throw new PlaybackCancelled();

    // ---- server audio ----
    if (url) {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.playbackRate = 0.85;
      audio.ontimeupdate = () => emitProgress(audio.currentTime, audio.duration || 0);

      return new Promise<void>((resolve, reject) => {
        settleCurrentRef.current = () => reject(new PlaybackCancelled());
        audio.onended = () => {
          settleCurrentRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          settleCurrentRef.current = null;
          reject(new Error("Audio playback failed"));
        };
        audio.play().catch((err) => {
          settleCurrentRef.current = null;
          reject(err);
        });
      });
    }

    // ---- browser voice fallback ----
    if (!hasBrowserTts()) throw new Error("No voice available");

    const handle = speakWithBrowser(text, lang, {
      rate: 0.9,
      onProgress: (p, d) => emitProgress(p, d),
    });
    browserSpeechRef.current = handle;

    return new Promise<void>((resolve, reject) => {
      settleCurrentRef.current = () => reject(new PlaybackCancelled());
      handle.done.then(
        () => {
          if (token !== tokenRef.current) return;
          settleCurrentRef.current = null;
          browserSpeechRef.current = null;
          resolve();
        },
        (err) => {
          if (token !== tokenRef.current) return;
          settleCurrentRef.current = null;
          browserSpeechRef.current = null;
          reject(err);
        }
      );
    });
  };

  const pause = () => {
    if (audioRef.current) audioRef.current.pause();
    browserSpeechRef.current?.pause();
    isPausedRef.current = true;
  };

  const resume = () => {
    if (!isPausedRef.current) return;
    if (audioRef.current) audioRef.current.play().catch(() => {});
    browserSpeechRef.current?.resume();
    isPausedRef.current = false;
  };

  const preload = async ({ text, lang }: AudioItem): Promise<void> => {
    if (isServerTtsDown()) return;
    try {
      await getServerAudio(text, langForText(text, lang));
    } catch {
      /* fallback is decided at play time */
    }
  };

  const stop = () => {
    tokenRef.current++;
    haltCurrent();
    emitProgress(0, 0);
  };

  return (
    <AudioContext.Provider value={{ play, pause, resume, stop, preload, subscribeProgress }}>
      {children}
    </AudioContext.Provider>
  );
};
