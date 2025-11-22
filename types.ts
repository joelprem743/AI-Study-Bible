// FIX: Import ReactNode to use it as a type.
import type { ReactNode } from 'react';

export interface VerseText {
    ESV: string;
    KJV: string;
    NIV: string;
    BSI_TELUGU?: string;
}

export interface Verse {
  verse: number;
  text: VerseText;
}

export interface Chapter {
  chapter: number;
  verses: Verse[];
}

export interface Book {
  book: string;
  chapters: Chapter[];
}

export type BibleData = Book[];

export interface VerseReference {
  book: string;
  chapter: number;
  verse: number;
}

export interface Message {
  id: string;
  // FIX: Use ReactNode type which was imported.
  text: string | ReactNode;
  sender: 'user' | 'bot';
  sources?: GroundingChunk[];
}

export enum ChatMode {
  FAST = 'gemini-2.5-flash-lite',
  STANDARD = 'gemini-2.5-flash',
  DEEP_THOUGHT = 'gemini-2.5-pro',
}

// FIX: Make the 'web' property optional to match the SDK type. The error indicates that the SDK's GroundingChunk may not always have a 'web' property.
export interface GroundingChunk {
    web?: {
      uri?: string;
      title?: string;
    };
}

export interface ParsedReference {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse?: number; // if undefined, it's a single verse
}

export interface FullVerse extends Verse, Omit<VerseReference, 'verse'> {
    // inherits verse: number
    // inherits text: VerseText
    // inherits book: string
    // inherits chapter: number
}

export interface BookMetadata {
    name: string;
    chapters: number;
    wasFuzzy?: boolean; // To indicate a typo was corrected
}
