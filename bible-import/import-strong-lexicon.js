const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function normalizeStrong(key) {
  if (!key) return null;
  if (key.startsWith("H") || key.startsWith("G")) return key;
  return `H${key}`;
}

async function run() {
  const file = path.resolve(__dirname, "data/HebrewStrong.xml");

  if (!fs.existsSync(file)) {
    console.error("❌ File not found:", file);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf8"));

  let inserted = 0;

  for (const [key, val] of Object.entries(raw)) {
    const strong = normalizeStrong(key);
    if (!strong) continue;

    const { error } = await supabase
      .from("strong_lexicon")
      .upsert({
        strong,
        lemma: val.lemma || "",
        gloss: val.gloss || "",
        definition: val.definition || "",
        language: "hebrew",
      });

    if (error) {
      console.error("❌ Insert failed:", strong, error.message);
      continue;
    }

    inserted++;
  }

  console.log(`✅ Hebrew Strong import complete: ${inserted}`);
}

run().catch((e) => {
  console.error("❌ Fatal error:", e);
});
