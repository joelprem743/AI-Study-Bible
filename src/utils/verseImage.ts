import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import { VerseReference } from "..";

export async function generateVerseImage(
  verseRef: VerseReference,
  verseText: string,
  language: "EN" | "TE"
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 1080;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  /* ---------- Background ---------- */
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#2563eb"); // blue-600
  gradient.addColorStop(1, "#4f46e5"); // indigo-600
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  /* ---------- Text styles ---------- */
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";

  const bookName =
    language === "TE"
      ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
      : verseRef.book;

  const refText = `${bookName} ${verseRef.chapter}:${verseRef.verse}`;

  /* ---------- Reference ---------- */
  ctx.font = "bold 48px serif";
  ctx.fillText(refText, width / 2, 140);

  /* ---------- Verse text ---------- */
  ctx.font = "42px serif";
  const maxWidth = width - 160;
  let y = 260;
  const lineHeight = 56;

  const words = verseText.split(" ");
  let line = "";

  for (const word of words) {
    const testLine = line + word + " ";
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth) {
      ctx.fillText(line, width / 2, y);
      line = word + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) ctx.fillText(line, width / 2, y);

  /* ---------- Footer ---------- */
  ctx.font = "28px serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText("AI Study Bible", width / 2, height - 80);

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), "image/png")
  );
}
