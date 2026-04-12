//src/utils/verseImage.ts
import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
import { VerseReference } from "..";

const MAX_CANVAS = 2048;
const SITE_URL = "biblecompanions.in";
const imageCache = new Map<string, HTMLImageElement>();

async function loadBitmap(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };

    img.onerror = reject;
    img.src = url;
  });
}


export async function generateVerseImage(
  verseRef: VerseReference,
  verseText: string | string[], // ✅ UPDATED: supports multiple verses
  language: "EN" | "TE",
  backgroundImageUrl?: string | null,
  gradient?: { from: string; to: string } | null,
  churchName?: string,
  rangeEnd?: number,
  layout: "portrait" | "square" = "portrait" 

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

  let bgBitmap: HTMLImageElement | null = null;
  let width = 1080;
  let height = layout === "square" ? 1080 : 1350;  // 4:5 portrait

  if (backgroundImageUrl) {
    try {
      bgBitmap = await loadBitmap(backgroundImageUrl);
  
      // Enforce layout dimensions
      width = 1080;
      height = layout === "square" ? 1080 : 1350;
  
    } catch (err) {
      console.error("BACKGROUND LOAD FAILED:", backgroundImageUrl, err);
      bgBitmap = null;
    }
  }

  const scale = 2; // 🔥 print clarity multiplier

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");
  
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.textRendering = "optimizeLegibility"; // 🔥 improves glyph shaping
ctx.imageSmoothingQuality = "high";
// Rounded corner mask
const radius = 60;

ctx.beginPath();
ctx.moveTo(radius, 0);
ctx.lineTo(width - radius, 0);
ctx.quadraticCurveTo(width, 0, width, radius);
ctx.lineTo(width, height - radius);
ctx.quadraticCurveTo(width, height, width - radius, height);
ctx.lineTo(radius, height);
ctx.quadraticCurveTo(0, height, 0, height - radius);
ctx.lineTo(0, radius);
ctx.quadraticCurveTo(0, 0, radius, 0);
ctx.closePath();
ctx.clip();
  /* ---------- BACKGROUND ---------- */

  if (bgBitmap) {
    const imgRatio = bgBitmap.width / bgBitmap.height;
    const canvasRatio = width / height;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgRatio > canvasRatio) {
      // image is wider → crop sides
      drawHeight = height;
      drawWidth = imgRatio * height;
      offsetX = -(drawWidth - width) / 2;
      offsetY = 0;
    } else {
      // image is taller → crop top/bottom
      drawWidth = width;
      drawHeight = width / imgRatio;
      offsetX = 0;
      offsetY = -(drawHeight - height) / 2;
    }
    
    ctx.drawImage(bgBitmap, offsetX, offsetY, drawWidth, drawHeight);
  
    const overlay = ctx.createLinearGradient(0, 0, 0, height);
    overlay.addColorStop(0, "rgba(0,0,0,0.55)");
    overlay.addColorStop(0.5, "rgba(0,0,0,0.45)");
    overlay.addColorStop(1, "rgba(0,0,0,0.65)");
  
    ctx.fillStyle = overlay;
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


  /* ---------- RESPONSIVE VERSE LAYOUT ---------- */

  const aspectRatio = height / width;
  const isPortrait = aspectRatio > 1.3;
  
  const columnWidth = Math.round(width * (isPortrait ? 0.68 : 0.66));
  const centerX = width / 2;
  
  const topPadding = Math.round(height * 0.14);

  const bottomReserved = isPortrait
    ? Math.round(height * 0.18)
    : 220;


    const maxTextHeight = isPortrait
    ? height - topPadding - bottomReserved
    : height - topPadding - bottomReserved;

    let baseFontSize;

if (isPortrait) {
  baseFontSize = language === "TE" ? 68 : 52;
} else {
  baseFontSize = language === "TE" ? 54 : 42;
}

let fontSize = baseFontSize;

// 🔥 ONLY CONTROL POINT
if (language === "TE") {
  fontSize = baseFontSize * 1.25;
}

  function wrapText(text: string, fontPx: number) {

    ctx.font =
    language === "TE"
    ? `500 ${fontPx}px "Gurajada", serif`
    : `700 ${fontPx}px "Montserrat", sans-serif`
  
    const lineHeight =
    language === "TE"
      ? Math.round(fontPx * 1.65)
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

  const minFontSize = language === "TE"
  ? (isPortrait ? 36 : 28)
  : (isPortrait ? 28 : 22);

  while (totalHeight > maxTextHeight && fontSize > minFontSize) {
    fontSize -= 1;
    blocks = wrapAll(fontSize);
    totalHeight = totalHeightFor(blocks);
  }
  /* Apply final font */
  ctx.font =
  language === "TE"
    ? `500 ${fontSize}px "Gurajada", serif`
    : `700 ${fontSize}px "Montserrat", sans-serif`;

  // if (bgBitmap) {
  //   ctx.fillStyle = "#ffffff";
  // } else {
  //   ctx.fillStyle = "#0f172a";
  //   ctx.shadowBlur = 0;
  // }

  /* Draw verses separately */
  let y = (height - totalHeight) / 2 + 10;
  // Soft halo glow behind verse text


  function drawProText(text: string, x: number, y: number) {
    ctx.textAlign = "center";
  
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
  
    const outerStroke =
      language === "TE"
        ? Math.max(4, fontSize * 0.12)
        : Math.max(2, fontSize * 0.05);
  
    const innerStroke =
      language === "TE"
        ? Math.max(2, fontSize * 0.05)
        : Math.max(1, fontSize * 0.025);
  
    // Outer
    ctx.lineWidth = outerStroke;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(text, x, y);
  
    // Inner
    ctx.lineWidth = innerStroke;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeText(text, x, y);
  
    // Fill
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y);
  }

  
ctx.shadowBlur = 0;
ctx.shadowColor = "transparent";

if (language === "EN") {
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
}

  blocks.forEach((block, index) => {

    // HARD verse separation BEFORE verse starts
    if (index !== 0) {
      y += block.lineHeight * 0.8;
    }
  
    block.lines.forEach(line => {

      if (line.trim().length === 0) return;
    
      drawProText(line, centerX, y); // 🔥 critical fix
    
      y += block.lineHeight;
    
    });
  
  });
  // Disable glow for other elements
ctx.shadowBlur = 0;

  /* ---------- REFERENCE ---------- */

  const referenceFontSize = isPortrait
  ? Math.max(20, Math.round(fontSize * 0.6))
  : Math.max(16, Math.round(fontSize * 0.55));

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";

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

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    
    if (language === "TE") {
      ctx.font = `500 ${referenceFontSize * 0.95}px "Gurajada", serif`;
      ctx.fillText(referenceLabel, centerX, y + 36);
    } else {
      ctx.globalAlpha = 0.7;
      ctx.font = `600 ${referenceFontSize * 0.8}px "Montserrat", sans-serif`;
      ctx.fillText(referenceLabel.toUpperCase(), centerX, y + 36);
    }
    
    ctx.globalAlpha = 1;

  /* ---------- FOOTER ---------- */
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
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  /* App Name */
  ctx.globalAlpha = 0.6;
  ctx.font = "600 26px Inter, system-ui, sans-serif";
  ctx.fillText(
    "Bible Companion",
    width / 2,
    footerY + (churchName ? 28 : 6)
  );
  /* URL */
  ctx.globalAlpha = isImageBackground ? 0.6 : 0.65;
  ctx.font = "500 18px Inter, system-ui, sans-serif";
  
  ctx.fillText(
    SITE_URL,
    width / 2,
    footerY + (churchName ? 58 : 32)
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