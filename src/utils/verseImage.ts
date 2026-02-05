import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import { VerseReference } from "..";

const MAX_CANVAS = 2048;
const SITE_URL = "ai-study-bible.vercel.app";

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Image fetch failed");

  const blob = await res.blob();
  if (!blob.size) throw new Error("Empty image blob");

  return await createImageBitmap(blob);
}

export async function generateVerseImage(
  verseRef: VerseReference,
  verseText: string,
  language: "EN" | "TE",
  backgroundImageUrl?: string | null,
  gradient?: { from: string; to: string } | null
): Promise<Blob> {

  if (!verseText.trim()) throw new Error("Empty verse");

  if ((document as any).fonts?.ready) {
    await (document as any).fonts.ready;
  }

  let bgBitmap: ImageBitmap | null = null;
  let width = 1080;
  let height = 1080;

  if (backgroundImageUrl) {
    try {
      bgBitmap = await loadBitmap(backgroundImageUrl);

      const scale = Math.min(
        MAX_CANVAS / bgBitmap.width,
        MAX_CANVAS / bgBitmap.height,
        1
      );

      width = Math.round(bgBitmap.width * scale);
      height = Math.round(bgBitmap.height * scale);
    } catch {
      bgBitmap = null;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  /* ---------- BACKGROUND ---------- */

  if (bgBitmap) {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bgBitmap, 0, 0, width, height);

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, width, height);
  } else {
    const g = ctx.createLinearGradient(0, 0, width, height);

    if (gradient) {
      g.addColorStop(0, gradient.from);
      g.addColorStop(1, gradient.to);
    } else {
      g.addColorStop(0, "#e2e8f0");
      g.addColorStop(1, "#cbd5e1");
    }
    
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

/* ---------- TEXT (PREMIUM VERSE LAYOUT) ---------- */

const columnWidth = Math.round(width * 0.64); // narrower = elegant
const startX = Math.round((width - columnWidth) / 2);
let y = Math.round(height * 0.30);


ctx.textBaseline = "top";
ctx.textAlign = "center";

// Subtle dark overlay ONLY for photos
if (bgBitmap) {
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  const overlay = ctx.createLinearGradient(0, 0, 0, height);
overlay.addColorStop(0, "rgba(0,0,0,0.45)");
overlay.addColorStop(0.4, "rgba(0,0,0,0.25)");
overlay.addColorStop(0.7, "rgba(0,0,0,0.05)");
overlay.addColorStop(1, "rgba(0,0,0,0)");
ctx.fillStyle = overlay;
ctx.fillRect(0, 0, width, height);

}

// Verse typography
ctx.font =
  language === "TE"
    ? "38px Noto Serif Telugu, serif"
    : "italic 36px Georgia, serif";

ctx.fillStyle = "#ffffff";
ctx.shadowColor = "rgba(0,0,0,0.4)";
ctx.shadowBlur = 6;
ctx.shadowOffsetY = 2;

const lineHeight = language === "TE" ? 64 : 58;

// Word wrapping (centered)
let line = "";
for (const word of verseText.split(/\s+/)) {
  const test = line + word + " ";
  if (ctx.measureText(test).width > columnWidth) {
    ctx.fillText(line.trim(), width / 2, y);
    line = word + " ";
    y += lineHeight;
  } else {
    line = test;
  }
}
if (line) {
  ctx.fillText(line.trim(), width / 2, y);
  y += lineHeight;
}

/* ---------- REFERENCE ---------- */

y += 36;

ctx.shadowBlur = 0;
ctx.globalAlpha = 0.6;
ctx.font = "500 22px Inter, system-ui, sans-serif";

const book =
  language === "TE"
    ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
    : verseRef.book;

ctx.fillText(`${book} ${verseRef.chapter}:${verseRef.verse}`, width / 2, y);

ctx.globalAlpha = 1;
ctx.textAlign = "left";


/* ---------- FOOTER (BRANDING + URL) ---------- */

const footerY = height - 120;

ctx.textAlign = "center";
ctx.textBaseline = "top";

ctx.globalAlpha = 0.6;
ctx.font = "600 22px Inter, system-ui, sans-serif";
ctx.fillStyle = "#ffffff";
ctx.fillText("Bible Companion", width / 2, footerY);

ctx.globalAlpha = 0.45;
ctx.font = "400 14px Inter, system-ui, sans-serif";
ctx.fillText(SITE_URL, width / 2, footerY + 22);

ctx.globalAlpha = 1;
ctx.textAlign = "left"; // reset


  /* ---------- EXPORT ---------- */

  ctx.fillStyle = "rgba(0,0,0,0.01)";
  ctx.fillRect(0, 0, 1, 1);

  return new Promise((res, rej) => {
    canvas.toBlob(b => (b ? res(b) : rej("Export failed")), "image/png");
  });
}