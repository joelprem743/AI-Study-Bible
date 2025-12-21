// scripts/utils/lemmaNormalize.ts

export function normalizeGreekLemma(input: string): string {
    if (!input) return "";
    return input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[᾿῀῾῍῎῏]/g, "")
      .toLowerCase()
      .trim();
  }
  
  export function normalizeHebrewLemma(input: string): string {
    if (!input) return "";
    return input
      .normalize("NFD")
      .replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, "")
      .trim();
  }
  