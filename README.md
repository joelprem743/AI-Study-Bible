AI Bible Study Companion

A full-featured, AI-enhanced Bible study web application combining fast scripture navigation, parallel Telugu/English display, and a context-aware Bible chatbot powered by Google Gemini.

Features
Parallel Scripture Display

Read Telugu and English (ESV, KJV, NIV) side-by-side on desktop

Mobile-optimized stacked view

Fast and Intuitive Navigation

Quickly jump to any book, chapter, or verse

AI Bible Chatbot

Provides context-aware theological answers

Integrates with multiple Gemini models

Chat Modes

Fast Mode: Low-latency (gemini-2.5-flash-lite)

Standard Mode: Balanced + Google Search grounding (gemini-2.5-flash)

Deep Thought Mode: Large-context reasoning (gemini-2.5-pro)

Interactive Verse Tools

Enabled when selecting any verse:

Interlinear (Hebrew/Greek → Transliteration → Word-by-word meaning)

Cross-references

Historical / Cultural Context

Personal Notes (stored locally in browser)

Keyword & Reference Search

Supports:

Single verses: John 3:16

Ranges: John 3:16–18

Multiple references: John 3:16, Psalm 23:1

Telugu references: యోహాను 3:16

Keywords (AI-assisted)

Project Setup
1. Add the Telugu Bible JSON (Required)

The app requires a complete telugubible.json file.

Required JSON Structure
Book → Chapter → Verse


Each verse object must contain a "Verse" key.

Example
{
  "Book": [
    {
      "Chapter": [
        {
          "Verse": [
            { "Verseid": "00000000", "Verse": "ఆదియందు దేవుడు భూమ్యాకాశములను సృజించెను." },
            { "Verseid": "00000001", "Verse": "భూమి నిరాకారముగాను శూన్యముగాను ఉండెను..." }
          ]
        }
      ]
    }
  ]
}

Placement

Place the file here:

/data/telugubible.json


This file is required for Telugu scripture rendering.

2. Configure the Gemini API Key

Set your Gemini API key as an environment variable:

VITE_API_KEY=your_key_here


The app automatically reads it via:

import.meta.env.VITE_API_KEY

Ready to Use

Once you have:

Added telugubible.json

Added VITE_API_KEY

the AI Bible Study Companion is fully operational.