// bible-import/import-strong-greek-step.js
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const FILE_PATH = path.join(
  __dirname,
  "data",
  "strong",
  "strongs-greek-step.txt"
);

function normalizeGreek(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function run() {
  console.log("▶ File exists:", fs.existsSync(FILE_PATH));

  const lines = fs.readFileSync(FILE_PATH, "utf8").split(/\r?\n/);

  // 🔥 THIS IS THE FIX
  const seen = new Map();

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;

    const parts = line.split("\t");
    if (parts.length < 2) continue;

    const strong = parts[0]?.trim();
    const lemma = parts[1]?.trim();
    const definition = parts.slice(3).join(" ").trim() || null;

    if (!/^G\d{4}$/.test(strong) || !lemma) continue;

    // KEEP FIRST OCCURRENCE ONLY
    if (!seen.has(strong)) {
      seen.set(strong, {
        strong,
        lemma,
        lemma_norm: normalizeGreek(lemma),
        definition,
        language: "gr",
      });
    }
  }

  const rows = [...seen.values()];
  console.log(`▶ Unique Strong numbers: ${rows.length}`);

  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from("strong_lexicon")
      .insert(batch);

    if (error) {
      console.error("❌ Batch insert error:", error.message);
      process.exit(1);
    }

    inserted += batch.length;
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Strong Greek lexicon import complete");
  console.log("Inserted:", inserted);
  console.log("━━━━━━━━━━━━━━━━━━━━━━");
}

run().catch(err => {
  console.error("🔥 Fatal:", err);
});
