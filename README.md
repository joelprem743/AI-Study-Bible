# AI Bible Study Companion

Welcome to the AI Bible Study Companion, a full-featured web application designed for professional and personal Bible study. This tool combines expert-level reference navigation, parallel scripture displays (Telugu/English), and an AI-powered Bible bot to deliver precise, context-rich theological answers.

## Features

-   **Parallel Scripture Display**: Read Telugu and English (ESV, KJV, NIV) translations side-by-side or stacked on mobile.
-   **Intuitive Navigation**: Quickly jump to any book, chapter, and verse with easy-to-use dropdowns.
-   **Advanced AI Chatbot**: Ask complex theological questions and get scholarly answers from Google's Gemini models.
-   **Multiple Chat Modes**:
    -   **Fast Mode**: For quick, low-latency responses (`gemini-2.5-flash-lite`).
    -   **Standard Mode**: For balanced answers, enhanced with Google Search grounding for up-to-date information (`gemini-2.5-flash`).
    -   **Deep Thought Mode**: For your most complex queries, leveraging a larger thinking budget (`gemini-2.5-pro`).
-   **Interactive Verse Tools**: Select any verse to access AI-generated tools:
    -   **Interlinear**: View the original Hebrew/Greek text with English transliteration and word-by-word breakdown.
    -   **Cross-references**: Discover thematically related verses.
    -   **Historical Context**: Understand the cultural and historical background of the text.
-   **Personal Notes**: Take and save your own notes for any verse, stored locally in your browser.

## Project Setup

To get the application running with all its features, you must complete the following setup steps.

### 1. Add the Telugu Bible Data File (Required)

This application now uses a local JSON file for all Telugu Bible verses to ensure data completeness and offline availability.

**A. Obtain `telugubible.json`**

You must provide this file. It should contain the entire Telugu Bible.

**B. Format the JSON File**

The file must be a single JSON object with a specific nested structure that follows the pattern: `Book -> Chapter -> Verse`. The root object must have a key named `"Book"`, which is an array of book objects. The order of books and chapters must match the standard Protestant Bible canon (Genesis to Revelation), as this is how the application maps them.

Each verse object must have a key `"Verse"` containing the Telugu text. The `"Verseid"` key is present but not used by the application.

**Example Format:**
```json
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
```

**C. Place the file**

Place your formatted `telugubible.json` file inside the `data/` directory of the project.

### 2. Configure Your Gemini API Key (Required for AI features)

The AI features (chatbot, verse analysis) are powered by the Google Gemini API. Your API key is expected to be available as an environment variable (`process.env.API_KEY`) in the execution environment. The application will use it automatically.

Your AI Bible Study Companion is now ready to use.