# Bible Companion (AI Study Bible) 📖🤖

Bible Companion is a modern Bible reading + study web app with **AI-powered assistance**, **English + Telugu support**, **parallel Bible reading**, and a full **personal study system** (highlights + notes).

It is designed for fast reading, deep study, and a clean premium UI across desktop and mobile.

---

## ✅ Key Features

### 📘 Bible Reader
- Book → Chapter → Verse navigation modal
- Next / Previous chapter navigation
- Clean Scripture reading experience with verse selection

### 🔁 Study Modes
- **Single Mode**: read one Bible version
- **Parallel Mode**: read two versions side-by-side (example: **English + Telugu**)

### 🌍 Multi-Language + Telugu Support
- Full Telugu Bible support (`TELUGU_COMMUNITY_V1`)
- Telugu book names mapping
- Telugu UI mode supported across multiple screens

### 🔍 Advanced Search
- Search by **Reference**
  - Example: `Psalm 23:1`, `John 3:16`, `యోహాను 3:16`
- Search by **Keyword** (English + Telugu)
- Search results grouped by:
  - Old Testament / New Testament
  - Book → Chapter → Verses
- Filters included:
  - Testament filter (Old/New)
  - Multi-book selection
  - Chapter range filter

### 🧠 AI Bible Companion Chatbot
AI-powered Bible study assistant with:
- **Scope selection**
  - Global
  - Chapter
  - Verse
- **Answer depth**
  - Short
  - Medium
  - Deep
- **Language control**
  - English
  - Telugu
- Smart verse references inside answers
  - Clickable verse references open a preview modal

### 🌅 Daily Verse Welcome Screen
A daily verse experience that includes:
- Verse display in English or Telugu
- AI-generated devotional content:
  - Meaning (2–3 simple sentences)
  - Application (2–3 practical steps)
- “Explain this verse” opens the AI chatbot automatically

---

## 👤 User System (Supabase)

### 🔐 Authentication
- Email/Password Sign In + Sign Up
- Google Sign In

### ✨ Highlights (Saved to Supabase)
- Highlight any verse using colors:
  - Yellow / Green / Pink / Blue
- View highlights in Profile:
  - Grouped by Old/New Testament
  - Book → Chapter → Verse
- Clicking a highlight navigates directly to the verse

### 📝 Notes System
Two types of notes:

#### 1) Verse Notes
- Notes attached to specific verses
- Grouped by Testament → Book → Chapter
- Expand/collapse view for clean UI
- “Go to verse” navigation supported

#### 2) Topical Notes
- Create long-form study notes (topics/sermons/devotionals)
- Edit / delete notes
- Add verses into topical notes
- Export topical notes to **DOCX** (Word document)

---

## ⚙️ Reader Settings
User-controlled reading preferences:
- Theme Mode:
  - System
  - Light
  - Dark
- Font Size:
  - Small / Medium / Large / Extra Large
- Auto Scroll Speed adjustment
- Reset to defaults

---

## 🛠 Tech Stack

### Frontend
- React + TypeScript
- Tailwind CSS
- FontAwesome Icons

### Backend / Database
- Supabase (Auth + Database)

### AI
- Gemini and llama-based service integration (AI devotional + chatbot)

### Export
- `docx` + `file-saver` for topical note downloads

---

## 📂 Project Structure (Simplified)

```txt
src/
  components/
    NavigationPane.tsx
    ScriptureDisplay.tsx
    VerseTools.tsx
    Chatbot.tsx
    WelcomeScreen.tsx
    SearchResultDisplay.tsx

    ProfileMenu.tsx
    ProfileHighlights.tsx
    ProfileNotes.tsx

  context/
    AuthContext.tsx
    NotesContext.tsx
    LanguageContext.tsx

  hooks/
    useHighlights.ts
    useReaderSettings.ts
    useThemeMode.ts

  services/
    bibleService.ts
    geminiService.ts

  lib/
    supabaseClient.ts
    dailyVerseService.ts
    bibleVersesService.ts
```
---


## 🚀 Getting Started
1) Clone the repository
git clone https://github.com/joelprem743/AI-Study-Bible.git
cd AI-Study-Bible

2) Install dependencies
npm install

3) Run development server
npm run dev

🔑 Environment Variables

Create a .env file:

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

VITE_GEMINI_API_KEY=your_ai_key


If AI keys are missing, the Bible reading features can still work, but AI features may fail.

##✅ Supported Bible Versions

Example versions included in the UI:

.Telugu Community Bible (TELUGU_COMMUNITY_V1)

.KJV

.NKJV

.ESV

.NIV

.NLT

.NASB (1995)

.GNB

.Aramaic Bible (Plain English - NT)


##👤 Author

Built by Joel Prem Tej
GitHub: https://github.com/joelprem743

Contact: joelpremtej@gmail.com
