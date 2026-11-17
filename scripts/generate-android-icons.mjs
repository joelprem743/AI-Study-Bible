// scripts/generate-android-icons.mjs
//
// Generates the Android launcher icons and splash images from the website logo
// (public/logo.png: gold Bible + cross on a navy circle).
// Re-run after changing the logo:  node scripts/generate-android-icons.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const LOGO = path.resolve("public/logo.png");
const RES = path.resolve("android/app/src/main/res");
const NAVY = "#152A45"; // the logo's circle colour

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const navy = (w, h) =>
  sharp({ create: { width: w, height: h, channels: 4, background: NAVY } });

const logoAt = (size) =>
  sharp(LOGO).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

for (const [density, scale] of Object.entries(DENSITIES)) {
  const dir = path.join(RES, `mipmap-${density}`);
  await fs.mkdir(dir, { recursive: true });

  // Legacy icons (Android 7 and older, some launchers): the round logo itself.
  const legacy = Math.round(48 * scale);
  const legacyLogo = await logoAt(legacy);
  await sharp(legacyLogo).toFile(path.join(dir, "ic_launcher.png"));
  await sharp(legacyLogo).toFile(path.join(dir, "ic_launcher_round.png"));

  // Adaptive icon foreground (Android 8+): 108dp canvas; the launcher shows
  // roughly the middle 72dp. The logo's navy circle is drawn slightly larger
  // than that window, so the gold emblem sits centred on navy for every
  // icon shape (circle, squircle, rounded square).
  const canvas = Math.round(108 * scale);
  const logoSize = Math.round(canvas * 0.72);
  const fg = await logoAt(logoSize);
  await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: fg, gravity: "center" }])
    .png()
    .toFile(path.join(dir, "ic_launcher_foreground.png"));
}

// Adaptive icon background colour
await fs.writeFile(
  path.join(RES, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${NAVY}</color>
</resources>
`
);

// Splash images (shown while the app starts): logo centred on navy.
for (const dirName of await fs.readdir(RES)) {
  if (!dirName.startsWith("drawable")) continue;
  const file = path.join(RES, dirName, "splash.png");
  try {
    await fs.access(file);
  } catch {
    continue;
  }
  const { width, height } = await sharp(file).metadata();
  const logo = await logoAt(Math.round(Math.min(width, height) * 0.5));
  const buf = await navy(width, height).composite([{ input: logo, gravity: "center" }]).png().toBuffer();
  await fs.writeFile(file, buf);
}

console.log("Android icons and splash images generated from public/logo.png");
