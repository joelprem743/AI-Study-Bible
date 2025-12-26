/**
 * TBESH Hebrew Strong Importer — FINAL
 */

require("dotenv").config();

const fs = require("fs");
const readline = require("readline");
const { createClient } = require("@supabase/supabase-js");

const FILE_PATH =
  "./data/strong/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew.txt";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function extractClassicStrong(eStrong) {
  const m = eStrong?.match(/^(H\d+)/);
  return m ? m[1] : null;
}

function clean(v) {
  return v && v.trim() !== "" ? v.trim() : null;
}

async function run() {
  const rl = readline.createInterface({
    input: fs.createReadStream(FILE_PATH, "utf8"),
    crlfDelay: Infinity,
  });

  let inserted = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.includes("\t") || line.startsWith("eStrong#")) continue;

    const cols = line.split("\t");
    if (cols.length < 7) {
      skipped++;
      continue;
    }

    const estrong = clean(cols[0]);
    const strong = extractClassicStrong(estrong);
    if (!estrong || !strong) {
      skipped++;
      continue;
    }

    const row = {
      estrong,
      strong,
      hebrew: clean(cols[3]),
      transliteration: clean(cols[4]),
      morph: clean(cols[5]),
      gloss: clean(cols[6]),
      meaning: clean(cols.slice(7).join("\t")),
    };

    const { error } = await supabase
      .from("strong_lexicon_heb")
      .upsert(row, { onConflict: "estrong" });

    if (error) throw error;
    inserted++;
  }

  console.log("Inserted:", inserted);
  console.log("Skipped:", skipped);
}

run().catch(console.error);
