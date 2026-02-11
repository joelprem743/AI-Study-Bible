//src/utils/verseImage.ts
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
  gradient?: { from: string; to: string } | null,
  churchName?: string,
  rangeEnd?: number
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
      g.addColorStop(0, "#0f172a"); // slate-900
      g.addColorStop(1, "#020617"); // near-black      
    }
    
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
// ✅ Subtle dark wash ONLY for gradients (keeps white text readable)
if (!bgBitmap) {
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, 0, width, height);
}
const isImageBackground = !!bgBitmap;

ctx.textBaseline = "top";
ctx.textAlign = "center";

// Subtle dark overlay ONLY for photos
if (bgBitmap) {
  const overlay = ctx.createLinearGradient(0, 0, 0, height);
  overlay.addColorStop(0, "rgba(0,0,0,0.45)");
  overlay.addColorStop(0.4, "rgba(0,0,0,0.25)");
  overlay.addColorStop(0.7, "rgba(0,0,0,0.05)");
  overlay.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);
}


/* ---------- RESPONSIVE VERSE LAYOUT ---------- */

const columnWidth = Math.round(width * 0.64);
const centerX = width / 2;
const topPadding = Math.round(height * 0.22);
const bottomReserved = 260; // space for ref + footer
const maxTextHeight = height - topPadding - bottomReserved;

let baseFontSize = language === "TE" ? 38 : 36;
let fontSize = baseFontSize;

function wrapText(text: string, fontPx: number) {
  ctx.font =
    language === "TE"
      ? `${fontPx}px Noto Serif Telugu, serif`
      : `italic ${fontPx}px Georgia, serif`;

  const lineHeight =
    language === "TE"
      ? Math.round(fontPx * 1.7)
      : Math.round(fontPx * 1.6);

  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = line ? `${line} ${word}` : word;

    if (ctx.measureText(testLine).width <= columnWidth) {
      line = testLine;
    } else {
      if (line) {
        lines.push(line);
        line = word;
      } else {
        // fallback if single word longer than column
        lines.push(word);
        line = "";
      }
    }
  }

  if (line) lines.push(line);

  return { lines, lineHeight };
}


/* 🔥 Auto scale loop */
let wrapped = wrapText(verseText, fontSize);
let totalHeight = wrapped.lines.length * wrapped.lineHeight;

while (totalHeight > maxTextHeight && fontSize > 22) {
  fontSize -= 2;
  wrapped = wrapText(verseText, fontSize);
  totalHeight = wrapped.lines.length * wrapped.lineHeight;
}

/* Apply final font */
ctx.font =
  language === "TE"
    ? `${fontSize}px Noto Serif Telugu, serif`
    : `italic ${fontSize}px Georgia, serif`;

/* Text color rules */
if (bgBitmap) {
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
} else {
  ctx.fillStyle = "#0f172a";
  ctx.shadowBlur = 0;
}

/* Draw text */
let y = topPadding;

for (const line of wrapped.lines) {
  ctx.fillText(line, centerX, y);
  y += wrapped.lineHeight;
}


/* ---------- REFERENCE ---------- */

const referenceFontSize = Math.max(16, Math.round(fontSize * 0.55));
y += Math.round(fontSize * 0.8);

ctx.shadowBlur = 0;
ctx.globalAlpha = bgBitmap ? 0.6 : 0.85;
ctx.fillStyle = bgBitmap ? "#ffffff" : "#334155";
ctx.font = `500 ${referenceFontSize}px Inter, system-ui, sans-serif`;

const book =
  language === "TE"
    ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
    : verseRef.book;

    const isSequential = rangeEnd !== undefined && rangeEnd === verseRef.verse + 1;

    const referenceLabel = rangeEnd
      ? isSequential
        ? `${book} ${verseRef.chapter}:${verseRef.verse}-${rangeEnd}`
        : `${book} ${verseRef.chapter}:${verseRef.verse}, ${rangeEnd}`
      : `${book} ${verseRef.chapter}:${verseRef.verse}`;
  
  ctx.fillText(referenceLabel, centerX, y);
  
  

ctx.globalAlpha = 1;



/* ---------- FOOTER (ATTRIBUTION + BRANDING + URL) ---------- */

const footerY = height - Math.max(110, Math.round(fontSize * 3));


ctx.textAlign = "center";
ctx.textBaseline = "top";
const footerColor = isImageBackground ? "#ffffff" : "#0f172a";

/* Optional Church Attribution */
if (churchName && churchName.trim()) {
  ctx.globalAlpha = isImageBackground ? 0.6 : 0.8;
  ctx.font = "400 16px Inter, system-ui, sans-serif";

  const attributionText =
    language === "TE"
      ? `— Shared by ${churchName}`
      : `— Shared by ${churchName}`;

  ctx.fillText(attributionText, width / 2, footerY);
}

/* App Name */
ctx.globalAlpha = 0.6;
ctx.font = "600 22px Inter, system-ui, sans-serif";
ctx.fillText(
  "Bible Companion",
  width / 2,
  footerY + (churchName ? 22 : 0)
);

/* URL */
ctx.globalAlpha = 0.45;
ctx.font = "400 14px Inter, system-ui, sans-serif";
ctx.fillText(
  SITE_URL,
  width / 2,
  footerY + (churchName ? 44 : 22)
);

ctx.globalAlpha = 1;
ctx.textAlign = "left"; // reset

  /* ---------- EXPORT ---------- */

  ctx.fillStyle = "rgba(0,0,0,0.01)";
  ctx.fillRect(0, 0, 1, 1);

  return new Promise((res, rej) => {
    canvas.toBlob(b => (b ? res(b) : rej("Export failed")), "image/png");
  });
}