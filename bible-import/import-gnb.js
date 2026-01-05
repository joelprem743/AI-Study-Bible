// import-aramaic-plain-en.js
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

// If your Node version <18, install node-fetch:
// const fetch = require("node-fetch");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const VERSION = "NASB";
const FILE_PATH = "./NASB 1995.json";

async function importAramaicPlainEnglish() {
  console.log("Reading JSON...");
  const raw = fs.readFileSync(FILE_PATH, "utf8");
  const data = JSON.parse(raw);

  const verses = [];

  for (const book of Object.keys(data)) {
    const chapters = data[book];
    if (typeof chapters !== "object") continue;

    for (const chapKey of Object.keys(chapters)) {
      const chapter = Number(chapKey);
      const verseObj = chapters[chapKey];
      if (typeof verseObj !== "object") continue;

      for (const verseKey of Object.keys(verseObj)) {
        const verse = Number(verseKey);
        const text = verseObj[verseKey];
        if (!text || typeof text !== "string") continue;

        verses.push({
          book,
          chapter,
          verse,
          text: text.trim(),
          version: VERSION,
        });
      }
    }
  }

  console.log(`Prepared ${verses.length} verses for ${VERSION}.`);

  const CHUNK = 500;
  for (let i = 0; i < verses.length; i += CHUNK) {
    const chunk = verses.slice(i, i + CHUNK);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bible_verses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(chunk),
    });

    if (!res.ok) {
      console.error("Supabase insert error:", await res.text());
      process.exit(1);
    }

    console.log(`Inserted ${Math.min(i+CHUNK, verses.length)} / ${verses.length}`);
  }

  console.log("Import complete!");
}

importAramaicPlainEnglish().catch(console.error);
