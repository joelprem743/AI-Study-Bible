// bible-import/import-tagnt-nt.js
// TAGNT New Testament importer (Strong + Morphology)

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const { createClient } = require("@supabase/supabase-js");

/* =======================
   SUPABASE
======================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =======================
   FILE PATH
======================= */

const NT_FILE = path.join(
  __dirname,
  "data",
  "nt-strong",
  "TAGNT_Act-Rev.txt"
);

/* =======================
   HELPERS
======================= */

// Example: Mat.1.1#03
function parseRef(ref) {
  const m = ref.match(/^([A-Za-z]+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return {
    book: m[1],
    chapter: Number(m[2]),
    verse: Number(m[3]),
  };
}

// Example: G2424=N-GSM-P
function parseStrongMorph(str) {
  const m = str.match(/(G\d+)\s*=\s*([A-Z0-9\-]+)/);
  if (!m) return null;
  return {
    strong: m[1],
    morph: m[2],
  };
}

/* =======================
   MAIN
======================= */

async function run() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━");
  console.log("▶ Starting TAGNT NT import");
  console.log("━━━━━━━━━━━━━━━━━━━━━━");

  if (!fs.existsSync(NT_FILE)) {
    console.error("❌ File not found:", NT_FILE);
    process.exit(1);
  }

  const lines = fs.readFileSync(NT_FILE, "utf8").split(/\r?\n/);

  let batch = [];
  let inserted = 0;
  let skipped = 0;
  let processed = 0;

  for (const line of lines) {
    processed++;

    // Skip comments / empty lines
    if (!line.trim() || line.startsWith("#")) {
      skipped++;
      continue;
    }

    const parts = line.split("\t");
    if (parts.length < 4) {
      skipped++;
      continue;
    }

    const refPart = parts[0];
    const surfacePart = parts[1];
    const strongPart = parts[3];

    const ref = parseRef(refPart);
    const strongMorph = parseStrongMorph(strongPart);

    if (!ref || !strongMorph || !surfacePart) {
      skipped++;
      continue;
    }

    const surface = surfacePart.split(" ")[0];

    // HARD VALIDATION — NO NULLS
    if (
      !ref.book ||
      !ref.chapter ||
      !ref.verse ||
      !surface ||
      !strongMorph.strong ||
      !strongMorph.morph
    ) {
      skipped++;
      continue;
    }

    batch.push({
      testament: "NT",
      book: ref.book,
      chapter: ref.chapter,
      verse: ref.verse,
      surface,
      lemma_raw: surface,
      lemma_norm: strongMorph.strong, // ✅ FIX HERE
      strong: strongMorph.strong,
      morph_code: strongMorph.morph,
    });

    if (batch.length === 500) {
      const { error } = await supabase
        .from("interlinear_words")
        .insert(batch);

      if (error) {
        console.error("❌ Batch insert error:", error.message);
      } else {
        inserted += batch.length;
      }

      batch = [];
    }

    if (processed % 5000 === 0) {
      console.log(`▶ Progress: ${processed} lines`);
    }
  }

  if (batch.length > 0) {
    const { error } = await supabase
      .from("interlinear_words")
      .insert(batch);

    if (error) {
      console.error("❌ Final batch error:", error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ TAGNT NT import complete");
  console.log("Inserted:", inserted);
  console.log("Skipped:", skipped);
  console.log("━━━━━━━━━━━━━━━━━━━━━━");
}

run().catch(err => {
  console.error("🔥 Fatal error:", err);
});
