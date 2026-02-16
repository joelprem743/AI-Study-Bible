export function buildVerseShareCaption(
    book: string,
    chapter: number,
    verse: number
  ): string {
    const url = `${window.location.origin}/#/${book}/${chapter}/${verse}`;
  
    return (
      `📖 ${book} ${chapter}:${verse}\n\n` +
      `Discover more in Bible Companion\n` +
      url
    );
  }
  
  export function buildVerseShareUrl(
    book: string,
    chapter: number,
    verse: number
  ): string {
    return `${window.location.origin}/#/${book}/${chapter}/${verse}`;
  }