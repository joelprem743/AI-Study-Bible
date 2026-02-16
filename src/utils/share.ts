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
  verse: number
): string {
  const url = buildVerseShareUrl(book, chapter, verse);

  return (
    `📖 ${book} ${chapter}:${verse}\n\n` +
    `Discover more in Bible Companion\n` +
    url
  );
}