// scripts/optimize-android-assets.mjs
//
// Runs after `npx cap copy android`. The website's verse backgrounds are huge
// PNGs (~244 MB). For the APK we replace them with WebP copies sized to the
// largest share image the app draws (2160 x 2700), which brings them down to a
// few MB. The app loads the .webp names (see src/constants/shareBackgrounds.ts).

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ASSETS = path.resolve("android/app/src/main/assets/public");
const BG_DIR = path.join(ASSETS, "verse-bg");
const COVER_W = 2160;
const COVER_H = 2700;

const exists = (p) => fs.access(p).then(() => true, () => false);

if (!(await exists(BG_DIR))) {
  console.error(`Not found: ${BG_DIR}\nRun "npx cap copy android" first.`);
  process.exit(1);
}

let before = 0;
let after = 0;

for (const file of await fs.readdir(BG_DIR)) {
  if (!/\.png$/i.test(file)) continue;

  const src = path.join(BG_DIR, file);
  const out = src.replace(/\.png$/i, ".webp");
  before += (await fs.stat(src)).size;

  const img = sharp(src, { limitInputPixels: false });
  const { width = COVER_W, height = COVER_H } = await img.metadata();
  const scale = Math.min(1, Math.max(COVER_W / width, COVER_H / height));

  await img
    .resize(Math.round(width * scale), Math.round(height * scale))
    .webp({ quality: 82 })
    .toFile(out);

  await fs.unlink(src);
  after += (await fs.stat(out)).size;
}

// Source maps are for debugging the website; they only add weight to the APK.
const assetsDir = path.join(ASSETS, "assets");
for (const file of await fs.readdir(assetsDir)) {
  if (file.endsWith(".map")) await fs.unlink(path.join(assetsDir, file));
}

const mb = (n) => (n / 1e6).toFixed(1) + " MB";
console.log(`verse-bg: ${mb(before)} -> ${mb(after)}`);
