// src/utils/verseImage.ts
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

  /* ---------------- Background (clean, calm) ---------------- */
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#f8fafc"); // slate-50
  bg.addColorStop(1, "#eef2f7"); // soft gray
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  /* ---------------- Padding system ---------------- */
  const paddingX = 120;
  let cursorY = 160;

  /* ---------------- Fonts ---------------- */
  const verseFont =
    language === "TE"
      ? "42px Noto Serif Telugu, serif"
      : "44px Inter, system-ui, sans-serif";

  const lineHeight = language === "TE" ? 68 : 64;
  const maxWidth = width - paddingX * 2;

  ctx.fillStyle = "#0f172a"; // slate-900
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  /* ---------------- Verse Text ---------------- */
  ctx.font = verseFont;

  const words = verseText.split(" ");
  let line = "";

  for (const word of words) {
    const testLine = line + word + " ";
    const { width: w } = ctx.measureText(testLine);

    if (w > maxWidth) {
      ctx.fillText(line, paddingX, cursorY);
      line = word + " ";
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, paddingX, cursorY);
    cursorY += lineHeight;
  }

  /* ---------------- Divider ---------------- */
  cursorY += 40;
  ctx.strokeStyle = "#cbd5e1"; // slate-300
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(paddingX, cursorY);
  ctx.lineTo(width - paddingX, cursorY);
  ctx.stroke();

  /* ---------------- Reference ---------------- */
  cursorY += 40;

  const bookName =
    language === "TE"
      ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
      : verseRef.book;

  const refText = `${bookName} ${verseRef.chapter}:${verseRef.verse}`;

  ctx.font = "500 32px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#334155"; // slate-700
  ctx.fillText(refText, paddingX, cursorY);

  /* ---------------- Footer (minimal branding) ---------------- */
  ctx.globalAlpha = 0.6;
  ctx.font = "24px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("AI Study Bible", paddingX, height - 80);
  ctx.globalAlpha = 1;

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), "image/png")
  );
}
