// src/types/index.ts
import type { ReactNode } from "react";

export interface VerseText {
  [version: string]: string;   // Allow any version key (KJV, ESV, NIV, others)
  KJV?: string;
  ESV?: string;
  NIV?: string;
  BSI_TELUGU?: string;
}


export interface Verse {
  verse: number;
  text: {
    [version: string]: string;
    ORIGINAL?: string;
  };
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
  sender: "user" | "bot";

  // User messages
  text?: string | ReactNode;

  // Bot structured answers (Option A)
  answer?: ChatbotAnswer;

  sources?: GroundingChunk[];
}


// export enum ChatMode {
//   FAST = "gemini-2.5-flash-lite",
//   STANDARD = "gemini-2.5-flash",
//   DEEP_THOUGHT = "gemini-2.5-pro",
// }

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
  endVerse?: number;
}

export interface FullVerse extends Verse, Omit<VerseReference, "verse"> {}

export interface BookMetadata {
  name: string;
  chapters: number;
  wasFuzzy?: boolean;
}

/* ============================================================
  CHATBOT STRUCTURED ANSWER (Option A)
============================================================ */

export interface ChatbotSection {
  title: string;
  explanation: string;
  references: string[]; // e.g. ["John 3:16", "Romans 8:1–4"]
}

export interface ChatbotAnswer {
  sections: ChatbotSection[];
}
