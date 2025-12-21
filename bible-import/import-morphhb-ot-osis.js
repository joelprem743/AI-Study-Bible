// bible-import/import-morphhb-ot-osis.js
// Old Testament Hebrew interlinear importer (OSIS MorphHB)
// HARDENED + BATCHED + SAFE

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

// ⛔ ONLY OT XML FILES SHOULD BE HERE
const OT_XML_DIR = path.join(__dirname, "data", "morphhb");

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

function normalizeStrong(raw) {
  if (!raw) return null;
  const num = String(raw).replace(/[^\d]/g, "");
  return num ? `H${num.padStart(4, "0")}` : null;
}

function log(msg) {
  console.log(msg);
}

/* =======================
   MAIN
======================= */

async function run() {
  const files = fs.readdirSync(OT_XML_DIR).filter(f => f.endsWith(".xml"));
  log(`▶ Found ${files.length} OT XML files`);

  let inserted = 0;
  let skipped = 0;

  const lastPos = {
    file: null,
    book: null,
    chapter: null,
    verse: null,
  };

  try {
    for (const file of files) {
      log(`▶ Parsing file: ${file}`);
      lastPos.file = file;

      const xml = fs.readFileSync(path.join(OT_XML_DIR, file), "utf8");
      const json = parser.parse(xml);

      // 🔒 SKIP non-scripture XMLs (VerseMap.xml etc.)
      if (!json?.osis?.osisText?.div) {
        log(`⏭ Skipping non-scripture file: ${file}`);
        continue;
      }

      const books = Array.isArray(json.osis.osisText.div)
        ? json.osis.osisText.div
        : [json.osis.osisText.div];

      let batch = [];

      for (const bookNode of books) {
        if (!bookNode.chapter) continue;

        const chapters = Array.isArray(bookNode.chapter)
          ? bookNode.chapter
          : [bookNode.chapter];

        for (const chapterNode of chapters) {
          if (!chapterNode.verse) continue;

          const verses = Array.isArray(chapterNode.verse)
            ? chapterNode.verse
            : [chapterNode.verse];

          for (const verseNode of verses) {
            const osis = verseNode.osisID;
            if (!osis) continue;

            const parts = osis.split(".");
            if (parts.length !== 3) continue;

            const [book, chapter, verse] = parts;

            lastPos.book = book;
            lastPos.chapter = Number(chapter);
            lastPos.verse = Number(verse);

            const words = Array.isArray(verseNode.w)
              ? verseNode.w
              : verseNode.w
              ? [verseNode.w]
              : [];

            for (const w of words) {
              if (!w.text || !w.lemma || !w.morph) {
                skipped++;
                continue;
              }

              const lemmaNorm = normalizeStrong(w.lemma);
              if (!lemmaNorm) {
                skipped++;
                continue;
              }

              batch.push({
                testament: "OT",
                book,
                chapter: Number(chapter),
                verse: Number(verse),
                surface: w.text,
                morph_code: w.morph,
                lemma_raw: String(w.lemma),
                lemma_norm: lemmaNorm,
              });

              // 🔥 flush every 500 rows
              if (batch.length === 500) {
                const { error } = await supabase
                  .from("interlinear_words")
                  .insert(batch);

                if (error) {
                  throw error;
                }

                inserted += batch.length;
                batch = [];
              }
            }
          }
        }
      }

      // flush remaining rows for file
      if (batch.length > 0) {
        const { error } = await supabase
          .from("interlinear_words")
          .insert(batch);

        if (error) {
          throw error;
        }

        inserted += batch.length;
      }
    }

    log("━━━━━━━━━━━━━━━━━━━━━━━━");
    log("✅ OT Hebrew OSIS import complete");
    log(`Inserted: ${inserted}`);
    log(`Skipped: ${skipped}`);
    log("━━━━━━━━━━━━━━━━━━━━━━━━");

  } catch (err) {
    console.error("🔥 Fatal import error");
    console.error("Last known position:");
    console.error(lastPos);
    console.error(err);
  }
}

run();
