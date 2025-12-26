const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false },
  }
);

const FILE = path.resolve(__dirname, "data/HebrewStrong.xml");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
});

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

async function run() {
  const xml = fs.readFileSync(FILE, "utf8");
  const json = parser.parse(xml);

  if (!json.lexicon?.entry) {
    throw new Error("❌ <lexicon><entry> not found");
  }

  const entries = asArray(json.lexicon.entry);
  console.log(`▶ Found ${entries.length} Hebrew Strong entries`);

  const rows = [];

  for (const entry of entries) {
    if (!entry.id) continue;

    const w = entry.w || {};
    const lemma = w["#text"] || "";
    const transliteration = w.xlit || "";

    let gloss = "";
    if (entry.meaning?.def) {
      gloss = Array.isArray(entry.meaning.def)
        ? entry.meaning.def.join("; ")
        : entry.meaning.def;
    }

    const definition = [
      typeof entry.source === "string" ? entry.source : "",
      typeof entry.usage === "string" ? entry.usage : "",
    ]
      .join(" ")
      .trim();

    rows.push({
      strong: entry.id,          // H1, H2, ...
      lemma,
      transliteration,
      gloss,
      definition,
    });
  }

  const BATCH_SIZE = 300;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from("strong_lexicon_he")
      .upsert(batch, { ignoreDuplicates: false });

    if (error) {
      console.error("❌ Batch insert failed at", i, error.message);
      process.exit(1);
    }

    inserted += batch.length;
    console.log(`✔ Inserted ${inserted}/${rows.length}`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Hebrew Strong import complete: ${inserted}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━");
}

run().catch(err => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
