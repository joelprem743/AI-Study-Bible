import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import type { VerseReference } from "../types";

/* --------------------------
   Build formatted verse text
---------------------------*/
export function buildVerseShareText(
  verseRef: VerseReference,
  verseText: string,
  language: "EN" | "TE"
) {
  const bookName =
    language === "TE"
      ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
      : verseRef.book;

  return `${bookName} ${verseRef.chapter}:${verseRef.verse}\n${verseText}`;
}

/* --------------------------
   Native Share API + fallback
---------------------------*/
export async function shareTextOrFallback(message: string) {
  const shareData = {
    title: "Bible Verse",
    text: message,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (err) {
      console.error("Native Share failed:", err);
    }
  }

  try {
    await navigator.clipboard.writeText(message);
    alert("Copied to clipboard.");
  } catch (err) {
    console.error("Clipboard copy failed:", err);
  }

  return false;
}

/* --------------------------
   Share as IMAGE (OG style)
---------------------------*/
export function getShareImageUrl(message: string) {
  // Your OG server (FastAPI / Vercel OG / Node)
  const encoded = encodeURIComponent(message);
  return `https://yourdomain.com/api/generateVerseImage?text=${encoded}`;
}
