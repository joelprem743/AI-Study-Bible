const SITE_ORIGIN = "https://biblecompanions.in";

export function buildVerseShareUrl(
  book: string,
  chapter: number,
  verse: number
): string {
  return `${SITE_ORIGIN}/#/${encodeURIComponent(book)}/${chapter}/${verse}`;
}

export function buildVerseShareCaption(
  book: string,
  chapter: number,
  verse: number,
  verseText?: string,
  language: "EN" | "TE" = "EN"
) {
  const reference = `${book} ${chapter}:${verse}`;

  if (language === "TE") {
    return `
📖 *${reference}*

"${verseText ?? ""}"

✨ దేవుని వాక్యాన్ని ధ్యానించండి.

మరిన్ని వచనాలు తెలుసుకోండి — Bible Companion 👇
`.trim();
  }

  return `
📖 *${reference}*

"${verseText ?? ""}"

✨ A moment to reflect on God’s word.

Explore more verses in Bible Companion 👇
`.trim();
}

