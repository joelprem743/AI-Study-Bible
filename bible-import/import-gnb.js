const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BIBLE_DIR = "./tel"; // directory with all book JSON files
const VERSION = "TELUGU_COMMUNITY_V1";
const CHUNK_SIZE = 500;

async function importTeluguBible() {
  const files = fs
    .readdirSync(BIBLE_DIR)
    .filter(f => f.endsWith(".json"));

  if (!files.length) {
    console.error("No JSON files found.");
    return;
  }

  console.log(`Found ${files.length} book files`);

  for (const file of files) {
    const filePath = path.join(BIBLE_DIR, file);
    console.log(`\nProcessing ${file}`);

    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);

    if (!data.book?.english || !Array.isArray(data.chapters)) {
      console.warn(`Skipping invalid file: ${file}`);
      continue;
    }

    const bookName = data.book.english;
    const verses = [];

    for (const ch of data.chapters) {
      const chapterNum = Number(ch.chapter);
      if (!Number.isInteger(chapterNum) || !Array.isArray(ch.verses)) continue;
    
      for (const v of ch.verses) {
        const verseNum = Number(v.verse);
        if (
          !Number.isInteger(verseNum) ||
          typeof v.text !== "string" ||
          !v.text.trim()
        ) continue;
    
        verses.push({
          book: bookName,
          chapter: chapterNum,
          verse: verseNum,
          text: v.text.trim(),
          version: VERSION,
        });
      }
    }
    

    console.log(`Prepared ${verses.length} verses`);

    for (let i = 0; i < verses.length; i += CHUNK_SIZE) {
      const chunk = verses.slice(i, i + CHUNK_SIZE);

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
        console.error(
          `Insert failed for ${bookName}:`,
          await res.text()
        );
        process.exit(1);
      }

      console.log(
        `Inserted ${Math.min(i + CHUNK_SIZE, verses.length)} / ${verses.length}`
      );
    }
  }

  console.log("\nAll books imported successfully.");
}

importTeluguBible().catch(err => {
  console.error("Fatal error:", err);
});
