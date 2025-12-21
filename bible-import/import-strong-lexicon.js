// bible-import/import-strong-lexicon.js
// Strong’s Hebrew + Greek lexicon importer (OSIS XML)
// FIXED to satisfy language CHECK ('he','gr')

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const { XMLParser } = require("fast-xml-parser");
const { createClient } = require("@supabase/supabase-js");

/* =======================
   ENV
======================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/* =======================
   PATH
======================= */

const STRONG_XML = path.join(
  __dirname,
  "data",
  "strong",
  "StrongHebrewGk.xml"
);

/* =======================
   XML PARSER
======================= */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
});

/* =======================
   HELPERS
======================= */

function normalizeStrong(id) {
  if (!id) return null;

  if (id.startsWith("H") || id.startsWith("G")) return id;

  if (/^\d+$/.test(id)) {
    return `H${id.padStart(4, "0")}`;
  }

  return null;
}

function normalizeLemma(lemma) {
  if (!lemma) return null;
  return lemma
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/* =======================
   MAIN
======================= */

async function run() {
  if (!fs.existsSync(STRONG_XML)) {
    throw new Error(`Strong XML not found: ${STRONG_XML}`);
  }

  console.log("▶ Loading Strong lexicon XML…");

  const xml = fs.readFileSync(STRONG_XML, "utf8");
  const json = parser.parse(xml);

  const glossary =
    Array.isArray(json?.osis?.osisText?.div)
      ? json.osis.osisText.div.find(d => d.type === "glossary")
      : json?.osis?.osisText?.div;

  if (!glossary?.div) {
    throw new Error("Glossary section not found in XML");
  }

  const entries = Array.isArray(glossary.div)
    ? glossary.div
    : [glossary.div];

  console.log(`▶ Found ${entries.length} Strong entries`);

  let inserted = 0;
  let skipped = 0;
  const batch = [];

  for (const entry of entries) {
    const w = entry.w;
    if (!w) {
      skipped++;
      continue;
    }

    const strong = normalizeStrong(w.ID);
    const lemma = w.lemma || w.text;
    const lemmaNorm = normalizeLemma(lemma);

    if (!strong || !lemmaNorm) {
      skipped++;
      continue;
    }

    // 🔑 THIS IS THE CRITICAL FIX
    const language = strong.startsWith("H") ? "he" : "gr";

    const gloss =
      Array.isArray(entry.list?.item)
        ? entry.list.item.join("; ")
        : entry.list?.item || null;

    batch.push({
      strong,
      lemma,
      lemma_norm: lemmaNorm,
      gloss,
      definition: null,
      language, // must be 'he' or 'gr'
    });

    if (batch.length === 500) {
      const { error } = await supabase
        .from("strong_lexicon")
        .upsert(batch, { onConflict: "strong" });

      if (error) {
        console.error("❌ Batch insert failed:", error.message);
      } else {
        inserted += batch.length;
      }
      batch.length = 0;
    }
  }

  if (batch.length) {
    const { error } = await supabase
      .from("strong_lexicon")
      .upsert(batch, { onConflict: "strong" });

    if (error) {
      console.error("❌ Final batch failed:", error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Strong lexicon import complete");
  console.log("Inserted:", inserted);
  console.log("Skipped:", skipped);
  console.log("━━━━━━━━━━━━━━━━━━━━━━");
}

run().catch(err => {
  console.error("🔥 Fatal error:", err);
});
