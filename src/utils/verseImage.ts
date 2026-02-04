import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import { VerseReference } from "..";

const MAX_CANVAS = 2048;

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
  backgroundImageUrl?: string | null
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
    } catch (e) {
      console.error("Bitmap load failed, using gradient", e);
      bgBitmap = null;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  /* ---------- BACKGROUND (ALWAYS PAINTED) ---------- */

  if (bgBitmap) {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(bgBitmap, 0, 0, width, height);

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, width, height);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "#e2e8f0");
    g.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  /* ---------- TEXT ---------- */

  const padX = Math.round(width * 0.1);
  let y = Math.round(height * 0.15);
  const maxW = width - padX * 2;

  const fontSize = language === "TE" ? 42 : 44;
  const lineHeight = language === "TE" ? 68 : 64;

  ctx.font =
    language === "TE"
      ? `${fontSize}px Noto Serif Telugu, serif`
      : `${fontSize}px Inter, system-ui, sans-serif`;

  ctx.fillStyle = bgBitmap ? "#ffffff" : "#0f172a";
  ctx.textBaseline = "top";

  if (bgBitmap) {
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
  }

  let line = "";
  for (const w of verseText.split(/\s+/)) {
    const t = line + w + " ";
    if (ctx.measureText(t).width > maxW) {
      ctx.fillText(line, padX, y);
      line = w + " ";
      y += lineHeight;
    } else {
      line = t;
    }
  }
  if (line) ctx.fillText(line, padX, y);

  /* ---------- REFERENCE ---------- */

  y += lineHeight + 40;
  ctx.font = "500 32px Inter, system-ui, sans-serif";

  const book =
    language === "TE"
      ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
      : verseRef.book;

  ctx.fillText(`${book} ${verseRef.chapter}:${verseRef.verse}`, padX, y);

/* ---------- FOOTER (WATERMARK) ---------- */

const footerY = height - 96;

ctx.globalAlpha = 0.65;

// Main title — bigger
ctx.font = "600 26px Inter, system-ui, sans-serif";
ctx.fillStyle = bgBitmap ? "#ffffff" : "#334155";
ctx.fillText("Bible Companion", padX, footerY);

// Sub text — smaller
ctx.font = "400 16px Inter, system-ui, sans-serif";
ctx.globalAlpha = 0.55;
ctx.fillText("by joel prem", padX, footerY + 26);

ctx.globalAlpha = 1;


  /* ---------- EXPORT (NON-EMPTY GUARANTEE) ---------- */

  ctx.fillStyle = "rgba(0,0,0,0.01)";
  ctx.fillRect(0, 0, 1, 1);

  return new Promise((res, rej) => {
    canvas.toBlob(b => (b ? res(b) : rej("Export failed")), "image/png");
  });
}
