// bible-import/import-nkjv.js
// CommonJS NKJV importer — identical structure to your NIV importer

const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

const { createClient } = require("@supabase/supabase-js");

// IMPORTANT: use the SERVICE ROLE key for inserts
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERROR: Missing Supabase env variables (SUPABASE_URL or SUPABASE_SERVICE_KEY)");
  process.exit(1);
}

const VERSION = "NKJV";
const FILE_PATH = "./NKJV.json";

async function importNKJV() {
  console.log("Loading NKJV.json...");
  const raw = fs.readFileSync(FILE_PATH, "utf8");
  const json = JSON.parse(raw);

  const verses = [];

  for (const book of Object.keys(json)) {
    for (const chapter of Object.keys(json[book])) {
      for (const verse of Object.keys(json[book][chapter])) {
        verses.push({
          book,
          chapter: Number(chapter),
          verse: Number(verse),
          text: json[book][chapter][verse],
          version: VERSION,
        });
      }
    }
  }

  console.log(`Prepared ${verses.length} verses to import...`);
  console.log("Importing into Supabase...");

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
      const errorText = await res.text();
      console.error("Error inserting chunk:", errorText);
      return;
    }

    console.log(`Inserted ${Math.min(i + CHUNK, verses.length)} / ${verses.length}`);
  }

  console.log("NKJV Import Complete!");
}

importNKJV().catch(console.error);
