//src/utils/verseImage.ts
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import { VerseReference } from "..";

const MAX_CANVAS = 2048;
const SITE_URL = "biblecompanions.in";

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Image fetch failed");

  const blob = await res.blob();
  if (!blob.size) throw new Error("Empty image blob");

  return await createImageBitmap(blob);
}


export async function generateVerseImage(
  verseRef: VerseReference,
  verseText: string | string[], // ✅ UPDATED: supports multiple verses
  language: "EN" | "TE",
  backgroundImageUrl?: string | null,
  gradient?: { from: string; to: string } | null,
  churchName?: string,
  rangeEnd?: number
): Promise<Blob> {

  console.log("VERSE TEXT TYPE:", typeof verseText);
console.log("VERSE TEXT VALUE:", verseText);
console.log("IS ARRAY:", Array.isArray(verseText));
  // ✅ normalize to array safely
  const verses = Array.isArray(verseText) ? verseText : [verseText];

  if (!verses.length || !verses[0].trim())
    throw new Error("Empty verse");

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
      g.addColorStop(0, "#0f172a");
      g.addColorStop(1, "#020617");
    }

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  if (!bgBitmap) {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, width, height);
  }

  const isImageBackground = !!bgBitmap;

  ctx.textBaseline = "top";
  ctx.textAlign = "center";

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
  const bottomReserved = 260;
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
  
    const lines: string[] = [];
  
    // split by manual line breaks FIRST
    const paragraphs = text.split("\n");
  
    for (const paragraph of paragraphs) {
  
      const words = paragraph.split(" ");
      let line = "";
  
      for (const word of words) {
  
        const testLine = line ? `${line} ${word}` : word;
  
        if (ctx.measureText(testLine).width <= columnWidth) {
          line = testLine;
        } else {
          if (line) lines.push(line);
          line = word;
        }
  
      }
  
      if (line) lines.push(line);
  
      // force extra break between paragraphs
      lines.push(""); 
    }
  
    return { lines, lineHeight };
  }
  /* 🔥 multi-verse wrap */
  function wrapAll(size: number) {

    const blocks = [];
  
    for (let i = 0; i < verses.length; i++) {
  
      const verse = verses[i];
  
      const wrapped = wrapText(verse, size);
  
      blocks.push({
        lines: wrapped.lines,
        lineHeight: wrapped.lineHeight,
        isVerseStart: true
      });
  
    }
  
    return blocks;
  }

  function totalHeightFor(blocks: ReturnType<typeof wrapAll>) {
    return blocks.reduce(
      (sum, b) => sum + b.lines.length * b.lineHeight + b.lineHeight * 0.8,
      0
    );
  }

  let blocks = wrapAll(fontSize);
  let totalHeight = totalHeightFor(blocks);

  while (totalHeight > maxTextHeight && fontSize > 22) {
    fontSize -= 2;
    blocks = wrapAll(fontSize);
    totalHeight = totalHeightFor(blocks);
  }

  /* Apply final font */
  ctx.font =
    language === "TE"
      ? `${fontSize}px Noto Serif Telugu, serif`
      : `italic ${fontSize}px Georgia, serif`;

  if (bgBitmap) {
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
  } else {
    ctx.fillStyle = "#0f172a";
    ctx.shadowBlur = 0;
  }

  /* Draw verses separately */
  let y = topPadding;

  blocks.forEach((block, index) => {

    // HARD verse separation BEFORE verse starts
    if (index !== 0) {
      y += block.lineHeight * 1.4;
    }
  
    block.lines.forEach(line => {
  
      if (line.trim().length === 0) return;
  
      ctx.fillText(line, centerX, y);
  
      y += block.lineHeight;
  
    });
  
  });

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

  const isSequential =
    rangeEnd !== undefined && rangeEnd === verseRef.verse + 1;

  const referenceLabel = rangeEnd
    ? isSequential
      ? `${book} ${verseRef.chapter}:${verseRef.verse}-${rangeEnd}`
      : `${book} ${verseRef.chapter}:${verseRef.verse}, ${rangeEnd}`
    : `${book} ${verseRef.chapter}:${verseRef.verse}`;

  ctx.fillText(referenceLabel, centerX, y);

  ctx.globalAlpha = 1;

  /* ---------- FOOTER ---------- */

  const footerY = height - Math.max(110, Math.round(fontSize * 3));

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  if (churchName?.trim()) {
    ctx.globalAlpha = isImageBackground ? 0.6 : 0.8;
    ctx.font = "400 16px Inter, system-ui, sans-serif";

    ctx.fillText(
      `— Shared by ${churchName}`,
      width / 2,
      footerY
    );
  }

  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;

  ctx.globalAlpha = 0.6;
  ctx.font = "600 26px Inter, system-ui, sans-serif";
  ctx.fillText(
    "Bible Companion",
    width / 2,
    footerY + (churchName ? 28 : 6)
  );

  ctx.globalAlpha = isImageBackground ? 0.6 : 0.65;
  ctx.font = "500 18px Inter, system-ui, sans-serif";

  ctx.fillText(
    SITE_URL,
    width / 2,
    footerY + (churchName ? 58 : 32)
  );

  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  /* ---------- EXPORT ---------- */

  ctx.fillStyle = "rgba(0,0,0,0.01)";
  ctx.fillRect(0, 0, 1, 1);

  return new Promise((res, rej) => {
    canvas.toBlob(b => (b ? res(b) : rej("Export failed")), "image/png");
  });
}