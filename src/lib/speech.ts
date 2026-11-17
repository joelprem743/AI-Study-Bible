// Shared text-to-speech helpers.
//
// Primary voice: the /api/tts server function (Sarvam).
// Fallback: the browser's built-in speechSynthesis, used automatically when
// the server call fails (bad/expired key, network error, quota), so read-aloud
// keeps working instead of silently stopping.

import { apiUrl } from "./platform";

export type SpeechLang = "EN" | "TE";

export const isTeluguText = (text: string) => /[ఀ-౿]/.test(text);

/** Pick the language from the text itself when it is clearly Telugu. */
export const langForText = (text: string, preferred: SpeechLang): SpeechLang =>
  isTeluguText(text) ? "TE" : preferred;

/* ------------------------------------------------------------------ */
/* Server TTS                                                          */
/* ------------------------------------------------------------------ */

// After a server failure, skip it for a while so each verse doesn't wait
// for a request that is going to fail anyway.
const SERVER_RETRY_AFTER_MS = 60_000;
let serverDownUntil = 0;

export const isServerTtsDown = () => Date.now() < serverDownUntil;

export async function fetchServerTts(
  text: string,
  lang: SpeechLang,
  signal?: AbortSignal
): Promise<Blob> {
  if (isServerTtsDown()) throw new Error("TTS server unavailable");

  try {
    const res = await fetch(apiUrl("/api/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
      signal,
    });
    if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

    const blob = await res.blob();
    if (blob.size < 100) throw new Error("Empty audio");
    return blob;
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      serverDownUntil = Date.now() + SERVER_RETRY_AFTER_MS;
      console.warn("[tts] server voice unavailable, using browser voice", err);
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Browser speechSynthesis fallback                                    */
/* ------------------------------------------------------------------ */

export const NO_TELUGU_VOICE = "NO_TELUGU_VOICE";

/** User-facing message for a failed read-aloud. */
export function describeTtsError(err: unknown, uiLang: SpeechLang): string {
  const te = uiLang === "TE";
  if (String((err as Error)?.message) === NO_TELUGU_VOICE) {
    return te
      ? "తెలుగు వాయిస్ ప్రస్తుతం అందుబాటులో లేదు. మీ పరికరంలో తెలుగు వాయిస్ ఇన్‌స్టాల్ చేయండి లేదా కొంతసేపటి తర్వాత ప్రయత్నించండి."
      : "Telugu voice isn't available right now. Install a Telugu voice in your device's speech settings, or try again later.";
  }
  return te ? "చదవడం సాధ్యం కాలేదు. మళ్ళీ ప్రయత్నించండి." : "Couldn't read aloud. Please try again.";
}

export const hasBrowserTts = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!hasBrowserTts()) return Promise.resolve([]);
  if (voicesReady) return voicesReady;

  voicesReady = new Promise((resolve) => {
    const now = speechSynthesis.getVoices();
    if (now.length) return resolve(now);

    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500); // some browsers never fire voiceschanged
  });
  return voicesReady;
}

async function pickVoice(lang: SpeechLang) {
  const voices = await loadVoices();
  const prefs = lang === "TE" ? ["te-IN", "te"] : ["en-IN", "en-GB", "en-US", "en"];
  for (const p of prefs) {
    const v = voices.find((x) => x.lang?.toLowerCase().startsWith(p.toLowerCase()));
    if (v) return v;
  }
  return null;
}

/** Chrome cuts off long utterances, so speak in sentence-sized pieces. */
function splitForSpeech(text: string, max = 220): string[] {
  const sentences = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      out.push(cur.trim());
      cur = "";
    }
    if (s.length > max) {
      // very long sentence: split on commas / spaces
      for (const w of s.split(/(?<=,)\s+|\s+/)) {
        if ((cur + " " + w).length > max && cur) {
          out.push(cur.trim());
          cur = "";
        }
        cur += (cur ? " " : "") + w;
      }
    } else {
      cur += s;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export interface BrowserSpeechHandle {
  done: Promise<void>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * Speak with the browser voice. `onProgress(charsSpoken, totalChars)` lets the
 * caller drive a progress bar.
 */
export function speakWithBrowser(
  text: string,
  lang: SpeechLang,
  opts: { rate?: number; onProgress?: (p: number, total: number) => void } = {}
): BrowserSpeechHandle {
  let cancelled = false;
  let settle: (() => void) | null = null;

  const done = new Promise<void>(async (resolve, reject) => {
    settle = resolve;
    if (!hasBrowserTts()) return reject(new Error("No speech synthesis"));

    speechSynthesis.cancel();
    const voices = await loadVoices();
    if (!voices.length) {
      // e.g. Android WebView / some embedded browsers: API exists, no voices
      return reject(new Error("No speech voices installed"));
    }
    const voice = await pickVoice(lang);
    if (!voice && lang === "TE") {
      // An English voice can't read Telugu script (silent / garbled)
      return reject(new Error(NO_TELUGU_VOICE));
    }
    const pieces = splitForSpeech(text);
    let offset = 0;

    for (const piece of pieces) {
      if (cancelled) return resolve();

      await new Promise<void>((res, rej) => {
        const u = new SpeechSynthesisUtterance(piece);
        u.lang = voice?.lang || (lang === "TE" ? "te-IN" : "en-IN");
        if (voice) u.voice = voice;
        u.rate = opts.rate ?? 0.95;
        // If speech never starts (broken engine), fail instead of hanging
        const startTimer = setTimeout(() => {
          speechSynthesis.cancel();
          rej("speech did not start");
        }, 5000);
        u.onstart = () => clearTimeout(startTimer);
        u.onboundary = (e) => opts.onProgress?.(offset + e.charIndex, text.length);
        u.onend = () => {
          clearTimeout(startTimer);
          res();
        };
        u.onerror = (e) => {
          clearTimeout(startTimer);
          if (e.error === "interrupted" || e.error === "canceled") res();
          else rej(e.error);
        };
        speechSynthesis.speak(u);
      }).catch((e) => {
        cancelled = true;
        reject(new Error(String(e)));
      });

      offset += piece.length + 1;
      opts.onProgress?.(Math.min(offset, text.length), text.length);
    }
    resolve();
  });

  return {
    done,
    cancel: () => {
      cancelled = true;
      if (hasBrowserTts()) speechSynthesis.cancel();
      settle?.();
    },
    pause: () => hasBrowserTts() && speechSynthesis.pause(),
    resume: () => hasBrowserTts() && speechSynthesis.resume(),
  };
}

/* ------------------------------------------------------------------ */
/* Speech recognition (STT)                                            */
/* ------------------------------------------------------------------ */

export const getSpeechRecognition = (): any =>
  typeof window === "undefined"
    ? null
    : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

export function describeSttError(code: string, lang: SpeechLang): string {
  const te = lang === "TE";
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return te
        ? "మైక్రోఫోన్ అనుమతి లేదు. బ్రౌజర్ సెట్టింగ్స్‌లో అనుమతించండి."
        : "Microphone access is blocked. Allow it in your browser settings.";
    case "no-speech":
      return te ? "ఏమీ వినిపించలేదు. మళ్ళీ ప్రయత్నించండి." : "Didn't hear anything. Try again.";
    case "audio-capture":
      return te ? "మైక్రోఫోన్ కనబడలేదు." : "No microphone found.";
    case "network":
      return te ? "నెట్‌వర్క్ లోపం. మళ్ళీ ప్రయత్నించండి." : "Network error during voice input. Try again.";
    case "language-not-supported":
      return te
        ? "ఈ బ్రౌజర్ తెలుగు వాయిస్ ఇన్‌పుట్‌కు మద్దతు ఇవ్వదు."
        : "Voice input isn't available for this language in this browser.";
    case "unsupported":
      return te
        ? "ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ అందుబాటులో లేదు. Chrome లేదా Edge ఉపయోగించండి."
        : "Voice input isn't supported in this browser. Try Chrome or Edge.";
    default:
      return te ? "వాయిస్ ఇన్‌పుట్ విఫలమైంది." : "Voice input failed. Try again.";
  }
}
