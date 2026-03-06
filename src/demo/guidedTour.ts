// src/demo/guidedTour.ts
import { driver, type DriveStep, type Config } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Creates and returns a driver.js instance configured for the Bible Companion guided tour.
 *
 * @param callbacks – hooks for App.tsx to programmatically change state
 *   before a step becomes visible (e.g. navigate to a chapter, open the chatbot).
 */
export function createGuidedTour(callbacks: {
    navigateTo: (book: string, chapter: number, verse?: number, opts?: { openTools?: boolean }) => void;
    setStudyMode: (mode: "single" | "parallel") => void;
    setIsChatOpen: (open: boolean) => void;
    setSearchOpen: (open: boolean) => void;
    onTourEnd: () => void;
}) {
    const {
        navigateTo,
        setStudyMode,
        setIsChatOpen,
        setSearchOpen,
        onTourEnd,
    } = callbacks;

    const steps: DriveStep[] = [
        // ── 0  Welcome ─────────────────────────────────────────────
        {
            popover: {
                title: "👋 Welcome to Bible Companion",
                description:
                    "Let me give you a quick tour of the key features. It only takes a minute!",
                side: "over" as const,
                align: "center" as const,
            },
        },

        // ── 1  Book / Chapter navigation ───────────────────────────
        {
            element: "#tour-book-selector",
            popover: {
                title: "📖 Navigate Scripture",
                description:
                    "Tap here to open any Book → Chapter → Verse. Navigate quickly through the entire Bible.",
                side: "bottom" as const,
                align: "center" as const,
            },
            onHighlightStarted: () => {
                setStudyMode("single");
                navigateTo("John", 3, 16);
            },
        },

        // ── 2  Version picker ──────────────────────────────────────
        {
            element: "#tour-version-picker",
            popover: {
                title: "📚 Choose Bible Version",
                description:
                    "Switch between KJV, ESV, NIV, Telugu Bible, and more. You can also enable Parallel Mode here.",
                side: "bottom" as const,
                align: "center" as const,
            },
        },

        // ── 3  Parallel reading ────────────────────────────────────
        {
            element: "#tour-book-selector",
            popover: {
                title: "🔁 Parallel Reading",
                description:
                    "Compare two Bible versions side-by-side — for example Telugu and English together.",
                side: "bottom" as const,
                align: "center" as const,
            },
            onHighlightStarted: () => {
                setStudyMode("parallel");
                navigateTo("John", 3, 16);
            },
        },

        // ── 4  Search ──────────────────────────────────────────────
        {
            element: "#tour-search-btn",
            popover: {
                title: "🔍 Smart Search",
                description:
                    'Search by reference ("Psalm 23:1", "యోహాను 3:16") or by keyword in English or Telugu.',
                side: "bottom" as const,
                align: "start" as const,
            },
            onHighlightStarted: () => {
                setStudyMode("single");
                navigateTo("John", 3, 16);
                setIsChatOpen(false);
            },
        },

        // ── 5  Scripture area (verse tap) ──────────────────────────
        {
            element: "#tour-scripture-area",
            popover: {
                title: "✋ Tap a Verse",
                description:
                    "Tap any verse to select it. You'll see tools for highlighting, sharing, notes, and AI explanation.",
                side: "top" as const,
                align: "center" as const,
            },
            onHighlightStarted: () => {
                setStudyMode("single");
                navigateTo("John", 3, 16);
            },
        },

        // ── 6  AI Chatbot ──────────────────────────────────────────
        {
            element: "#tour-chatbot-fab",
            popover: {
                title: "🧠 AI Bible Companion",
                description:
                    "Ask any Bible question! Get instant AI explanations in English or Telugu with adjustable depth.",
                side: "left" as const,
                align: "center" as const,
            },
            onHighlightStarted: () => {
                setIsChatOpen(false);
                setSearchOpen(false);
            },
        },

        // ── 7  Profile / Settings ──────────────────────────────────
        {
            element: "#tour-profile-btn",
            popover: {
                title: "👤 Your Profile",
                description:
                    "Sign in to save highlights, write notes, and sync your progress across devices. Adjust reader settings here too.",
                side: "bottom" as const,
                align: "end" as const,
            },
        },

        // ── 8  Done ────────────────────────────────────────────────
        {
            popover: {
                title: "🎉 You're All Set!",
                description:
                    "Explore and grow deeper in Scripture. You can restart this tour anytime from the profile menu. God bless!",
                side: "over" as const,
                align: "center" as const,
            },
        },
    ];

    const tourConfig: Config = {
        steps,
        animate: true,
        showProgress: true,
        showButtons: ["next", "previous", "close"],
        smoothScroll: true,
        allowClose: true,
        overlayOpacity: 0.6,
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: "bible-companion-tour-popover",
        onDestroyStarted: () => {
            localStorage.setItem("demo_completed", "true");
            onTourEnd();
            tourInstance.destroy();
        },
    };

    const tourInstance = driver(tourConfig);
    return tourInstance;
}
