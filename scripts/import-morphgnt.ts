/* scripts/import-morphgnt.ts */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { normalizeGreekLemma } from "./utils/lemmaNormalize";

// ---------- CONFIG ----------
const FILE_PATH = path.join(
  process.cwd(),
  "scripts",
  "data",
  "morphgnt.txt"
);

// ---------- SUPABASE ----------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------- TYPES ----------
type MorphRow = {
  book_chapter_verse: string;
  morph_code: string;
  surface: string;
  lemma_raw: string;
  lemma_norm: string;
};

// ---------- MAIN ----------
async function run() {
  console.log("▶ MorphGNT import started");

  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(`MorphGNT file not found: ${FILE_PATH}`);
  }

  const raw = fs.readFileSync(FILE_PATH, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  console.log(`▶ Loaded ${lines.length} lines`);

  let inserted = 0;
  let skipped = 0;

  for (const line of lines) {
    /**
     * Expected format (space-separated):
     * 010101 N- ----NSF- Βίβλος Βίβλος βίβλος βίβλος
     */
    const parts = line.split(/\s+/);

    if (parts.length < 6) {
      skipped++;
      console.warn("⚠ Skipping malformed line:", line);
      continue;
    }

    const [
      ref,
      _pos,
      morph,
      surface,
      _surface2,
      lemmaRaw
    ] = parts;

    const row: MorphRow = {
      book_chapter_verse: ref,
      morph_code: morph,
      surface,
      lemma_raw: lemmaRaw,
      lemma_norm: normalizeGreekLemma(lemmaRaw),
    };

    const { error } = await supabase
      .from("interlinear_words")
      .insert(row);

    if (error) {
      console.error("❌ Insert failed:", error.message, row);
      continue;
    }

    inserted++;
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Import finished`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped:  ${skipped}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━");
}

// ---------- EXECUTE ----------
run().catch(err => {
  console.error("❌ MorphGNT import crashed:", err);
  process.exit(1);
});
