import { createContext, useContext, useRef } from "react";

type AudioItem = {
  text: string;
  lang: "EN" | "TE";
};

type AudioContextType = {
  play: (item: AudioItem) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  preload: (item: AudioItem) => Promise<void>;
  subscribeProgress: (cb: (p: number, d: number) => void) => () => void;
};

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = () => {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be inside AudioProvider");
  return ctx;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const currentUrlRef = useRef<string | null>(null); // 🔥 NEW
  const isPausedRef = useRef(false);
  const progressRef = useRef(0);
const durationRef = useRef(0);
const listenersRef = useRef<((p: number, d: number) => void)[]>([]);

  // 🔥 GENERATE TTS WITH CACHE
  const generateTTS = async (text: string, lang: "EN" | "TE") => {
    const key = `${lang}:${text}`;

    if (cacheRef.current.has(key)) {
      return cacheRef.current.get(key)!;
    }

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, lang }),
    });

    if (!res.ok) {
      throw new Error(`TTS failed: ${res.status}`);
    }

    const blob = await res.blob();

    if (blob.size === 0) {
      throw new Error("Empty audio");
    }

    const url = URL.createObjectURL(blob);

    cacheRef.current.set(key, url);

    return url;
  };


  const subscribeProgress = (cb: (p: number, d: number) => void) => {
    listenersRef.current.push(cb);
  
    return () => {
      listenersRef.current = listenersRef.current.filter(l => l !== cb);
    };
  };

  const play = async ({ text, lang }: AudioItem): Promise<void> => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const url = await generateTTS(text, lang);

    // 🔥 CLEAN OLD URL
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
    }
    
    currentUrlRef.current = url;
    
    const audio = new Audio(url);

    audioRef.current = audio;
    isPausedRef.current = false;
    
    // 🔥 CONTROL SPEED (0.85 = slower, 0.7 = very slow)
    audio.playbackRate = 0.85;
// 🔥 PROGRESS TRACKING
audio.ontimeupdate = () => {
  progressRef.current = audio.currentTime;
  durationRef.current = audio.duration || 0;

  listenersRef.current.forEach(cb =>
    cb(progressRef.current, durationRef.current)
  );
};

    return new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = reject;
      audio.play().catch(reject);
    });
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      isPausedRef.current = true;
    }
  };

  const resume = () => {
    if (audioRef.current && isPausedRef.current) {
      audioRef.current.play().catch(() => {});
      isPausedRef.current = false;
    }
  };

  const preload = async ({ text, lang }: AudioItem): Promise<void> => {
    await generateTTS(text, lang);
  };

const stop = () => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = "";
    audioRef.current.load();
    audioRef.current = null;
  }

  // 🔥 CLEAN URL MEMORY
  if (currentUrlRef.current) {
    URL.revokeObjectURL(currentUrlRef.current);
    currentUrlRef.current = null;
  }

  // 🔥 RESET PROGRESS (UI FIX)
  progressRef.current = 0;
  durationRef.current = 0;

  listenersRef.current.forEach(cb => cb(0, 0));
};

  return (
    <AudioContext.Provider value={{ play, pause, resume, stop, preload, subscribeProgress }}>
      {children}
    </AudioContext.Provider>
  );
};