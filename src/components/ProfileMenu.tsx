// src/components/ProfileMenu.tsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import ProfileNotes from "./ProfileNotes";
import ProfileHighlights from "./ProfileHighlights";
import type { ReaderSettings, FontSize } from "../hooks/useReaderSettings";


type AuthMode = "signin" | "signup";

type ProfileMenuProps = {
  readerSettings: ReaderSettings;
  setReaderSettings: (next: ReaderSettings) => void;
  onGoHome: () => void;
};



export default function ProfileMenu({
  readerSettings,
  setReaderSettings,
  onGoHome,
}: ProfileMenuProps) {

  const { user, signIn, signUp, signOut, signInWithGoogle, language, setLanguage,  bibleVersion, } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  const [isReaderSettingsOpen, setIsReaderSettingsOpen] = useState(false);

  const [isHighlightsOpen, setIsHighlightsOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Close dropdown on login/logout
  useEffect(() => {
    setIsDropdownOpen(false);
  }, [user]);

  const handleAuthOpen = (mode: AuthMode) => {
    setMode(mode);
    setIsAuthModalOpen(true);
    setError(null);
    setEmail("");
    setPassword("");
    setFirstName("");
  };



  const handleSubmit = async () => {
    setError(null);

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    if (mode === "signup" && !firstName.trim()) {
      setError("First name is required.");
      return;
    }

    try {
      setSubmitting(true);

      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        const { error } = await signUp(email, password, {
          first_name: firstName.trim(),
        });
        if (error) throw error;
      }

      setIsAuthModalOpen(false);
    } catch (err: any) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await signOut();
  };

  // ------------------ LOGGED OUT VIEW -------------------
  if (!user) {
    return (
      <>
        <button
  onClick={() => handleAuthOpen("signin")}
  aria-label="Open profile"
  className="
    w-10 h-10
    flex items-center justify-center
    rounded-2xl
    bg-white/10 dark:bg-white/5
    border border-white/10
    text-white
    shadow-sm
    hover:bg-white/15
    hover:border-white/15
    hover:shadow-[0_0_10px_rgba(59,130,246,0.35)]
    transition-all duration-150
  "
>
  <i className="fas fa-user text-lg text-white/90" />
</button>



        {isAuthModalOpen && (
          <AuthModal
            mode={mode}
            email={email}
            password={password}
            firstName={firstName}
            setEmail={setEmail}
            setPassword={setPassword}
            setFirstName={setFirstName}
            submitting={submitting}
            error={error}
            onClose={() => setIsAuthModalOpen(false)}
            onSubmit={handleSubmit}
            switchMode={() =>
              setMode((m) => (m === "signin" ? "signup" : "signin"))
            }
            signInWithGoogle={signInWithGoogle}
          />
        )}
      </>
    );
  }

  // ------------------ LOGGED IN VIEW -------------------

  const settings: ReaderSettings = readerSettings || {
    fontSize: "md",
    autoScrollSpeed: 1,
    autoScrollIntervalMs: 60,
    themeMode: "system",
  };
  
  const updateSettings = (patch: Partial<ReaderSettings>) => {
    setReaderSettings({
      ...(readerSettings ?? {
        fontSize: "md",
        autoScrollSpeed: 1,
        autoScrollIntervalMs: 60,
        themeMode: "system",
      }),
      ...patch,
    });
  };
  
  


  const firstLetter =
    user.user_metadata?.first_name?.trim()?.[0]?.toUpperCase() ??
    user.email?.[0]?.toUpperCase() ??
    "U";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      
      <button
  onClick={() => setIsDropdownOpen((v) => !v)}
  aria-label="Open profile menu"
  className="
    w-10 h-10
    flex items-center justify-center
    rounded-2xl
    bg-white/10 dark:bg-white/5
    border border-white/10
    text-white
    font-semibold
    shadow-sm
    hover:bg-white/15
    hover:border-white/15
    hover:shadow-[0_0_10px_rgba(59,130,246,0.35)]
    transition-all duration-150
  "
>
  <span className="text-white/90">
    {firstLetter}
  </span>
</button>






{/* Dropdown Menu */}
{isDropdownOpen && (
  <div
    className="
      absolute right-0 mt-2 w-56
      rounded-2xl shadow-xl z-50
      bg-white/95 dark:bg-slate-900
      border border-slate-200/60 dark:border-white/10
      backdrop-blur-xl
      overflow-hidden
      divide-y divide-slate-200/60 dark:divide-white/10
    "
  >

    {/* HOME */}
    <button
      onClick={() => {
        setIsDropdownOpen(false);
        onGoHome();
      }}
      className="
        w-full flex items-center gap-3
        px-4 py-2.5 text-sm
        text-slate-700 dark:text-white/85
        hover:bg-slate-100/70 dark:hover:bg-white/5
        transition-colors
      "
    >
      <i className="fas fa-home w-4 text-slate-500 dark:text-white/60"></i>
      <span>Home</span>
    </button>


    {/* HIGHLIGHTS */}
    <button
      onClick={() => {
        setIsHighlightsOpen(true);
        setIsDropdownOpen(false);
      }}
      className="
        w-full flex items-center gap-3
        px-4 py-2.5 text-sm
        text-slate-700 dark:text-white/85
        hover:bg-slate-100/70 dark:hover:bg-white/5
        transition-colors
      "
    >
      <i className="fas fa-highlighter w-4 text-slate-500 dark:text-white/60"></i>
      <span>My Highlights</span>
    </button>


    {/* NOTES */}
    <button
      onClick={() => {
        setIsNotesOpen(true);
        setIsDropdownOpen(false);
      }}
      className="
        w-full flex items-center gap-3
        px-4 py-2.5 text-sm
        text-slate-700 dark:text-white/85
        hover:bg-slate-100/70 dark:hover:bg-white/5
        transition-colors
      "
    >
      <i className="fas fa-book-open w-4 text-slate-500 dark:text-white/60"></i>
      <span>My Notes</span>
    </button>


    {/* LANGUAGE */}
    <button
      onClick={() => setLanguage(language === "EN" ? "TE" : "EN")}
      className="
        w-full flex items-center justify-between
        px-4 py-2.5 text-sm
        text-slate-700 dark:text-white/85
        hover:bg-slate-100/70 dark:hover:bg-white/5
        transition-colors
      "
    >
      <div className="flex items-center gap-3">
        <i className="fas fa-language w-4 text-slate-500 dark:text-white/60"></i>
        <span>Language</span>
      </div>

      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
        {language}
      </span>
    </button>


    {/* READER SETTINGS */}
    <button
      onClick={() => {
        setIsDropdownOpen(false);
        setIsReaderSettingsOpen(true);
      }}
      className="
        w-full flex items-center gap-3
        px-4 py-2.5 text-sm
        text-slate-700 dark:text-white/85
        hover:bg-slate-100/70 dark:hover:bg-white/5
        transition-colors
      "
    >
      <i className="fas fa-sliders-h w-4 text-slate-500 dark:text-white/60"></i>
      <span>Reader Settings</span>
    </button>


    {/* LOGOUT */}
    <button
      onClick={handleLogout}
      className="
        w-full flex items-center gap-3
        px-4 py-2.5 text-sm
        text-red-600 dark:text-red-400
        hover:bg-red-50 dark:hover:bg-red-900/20
        transition-colors
      "
    >
      <i className="fas fa-sign-out-alt w-4"></i>
      <span>Logout</span>
    </button>

  </div>
)}

      {/* Highlights Modal */}
      {isHighlightsOpen && (
        <ProfileHighlights
        userId={user.id}
        onClose={() => setIsHighlightsOpen(false)}
        bibleVersion={language === "TE" ? "TELUGU_COMMUNITY_V1" : "KJV"}
      />
      
      )}
      {isNotesOpen && (
        <ProfileNotes
          userId={user.id}
          onClose={() => setIsNotesOpen(false)}
        />
      )}

{isReaderSettingsOpen && (
  <div
  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center"
    onClick={() => setIsReaderSettingsOpen(false)}
  >
    <div
      className="
      w-full max-w-sm rounded-2xl
      bg-gradient-to-b
      from-white via-slate-50 to-slate-100
      dark:from-slate-900 dark:via-slate-800 dark:to-slate-900
      border border-slate-200 dark:border-slate-700
      ring-1 ring-inset ring-white/40 dark:ring-white/5
      shadow-[0_10px_25px_rgba(0,0,0,0.25),0_4px_10px_rgba(0,0,0,0.15)]
      p-5
      "      
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Reader Settings
      </h2>
      {/* THEME MODE */}
<div className="mb-4">
  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
    Theme
  </label>

  <select
  value={settings.themeMode}
  onChange={(e) => {
    const mode = e.target.value as "system" | "light" | "dark";
    updateSettings({ themeMode: mode });
  }}
  style={{ colorScheme: "light dark" }}
  className="
    w-full px-3 py-2 rounded-xl

    appearance-none

    bg-gradient-to-b
    from-slate-100 to-slate-200
    dark:from-slate-800 dark:to-slate-700

    text-gray-900 dark:text-gray-100

    border border-slate-300 dark:border-slate-600

    ring-1 ring-inset ring-white/40 dark:ring-white/5

    shadow-[0_1px_2px_rgba(0,0,0,0.10)]

    focus:outline-none
    focus:ring-2 focus:ring-blue-500/40
  "
>

    <option value="system">System</option>
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  </select>
</div>


      {/* FONT SIZE */}
      <div className="mb-4">
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
          Font Size
        </label>
        <select
  value={settings.themeMode}
  onChange={(e) => {
    const mode = e.target.value as "system" | "light" | "dark";
    updateSettings({ themeMode: mode });
  }}
  style={{ colorScheme: "light dark" }}
  className="
    w-full px-3 py-2 rounded-xl

    appearance-none

    bg-gradient-to-b
    from-slate-100 to-slate-200
    dark:from-slate-800 dark:to-slate-700

    text-gray-900 dark:text-gray-100

    border border-slate-300 dark:border-slate-600

    ring-1 ring-inset ring-white/40 dark:ring-white/5

    shadow-[0_1px_2px_rgba(0,0,0,0.10)]

    focus:outline-none
    focus:ring-2 focus:ring-blue-500/40
  "
>


          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
          <option value="xl">Extra Large</option>
        </select>
      </div>

      {/* AUTO SCROLL SPEED */}
      <div className="mb-4">
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
          Auto Scroll Speed
        </label>

        <input
  type="range"
  min={1}
  max={8}
  value={settings.autoScrollSpeed}
  onChange={(e) => {
    const speed = Number(e.target.value);
    updateSettings({ autoScrollSpeed: speed });
  }}
  className="
w-full
accent-blue-600
dark:accent-blue-500
bg-slate-200 dark:bg-slate-700
rounded-lg
"

/>


        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
        Speed: {settings.autoScrollSpeed}
        </div>
      </div>

      <div className="flex justify-end gap-2">
      <button
  onClick={() => {
    updateSettings({
      fontSize: "md",
      autoScrollSpeed: 1,
      autoScrollIntervalMs: 60,
      themeMode: "system",
    });
  }}
  className="
px-3 py-2 rounded-xl text-sm
bg-gradient-to-b
from-slate-200 to-slate-300
dark:from-slate-700 dark:to-slate-600
border border-slate-300 dark:border-slate-600
ring-1 ring-inset ring-white/40 dark:ring-white/5
shadow-[0_1px_2px_rgba(0,0,0,0.12)]
hover:from-slate-300 hover:to-slate-400
dark:hover:from-slate-600 dark:hover:to-slate-500
transition-all
"
>
  Reset
</button>


        <button
          onClick={() => setIsReaderSettingsOpen(false)}
          className="
px-4 py-2 rounded-xl text-sm text-white font-medium
bg-gradient-to-b
from-blue-600 to-blue-700
border border-blue-500/40
ring-1 ring-inset ring-white/20
shadow-[0_2px_6px_rgba(37,99,235,0.5)]
hover:from-blue-500 hover:to-blue-600
transition-all
"

        >
          Done
        </button>
      </div>
    </div>
  </div>
)}


    </div>
  );
}

// ------------------------------------------------------------
// AUTH MODAL
// ------------------------------------------------------------

interface AuthModalProps {
  mode: AuthMode;
  email: string;
  password: string;
  firstName: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setFirstName: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  switchMode: () => void;
  signInWithGoogle: () => Promise<any>;
}

function AuthModal({
  mode,
  email,
  password,
  firstName,
  setEmail,
  setPassword,
  setFirstName,
  submitting,
  error,
  onClose,
  onSubmit,
  switchMode,
  signInWithGoogle,
}: AuthModalProps) {
  const handleGoogleLogin = async () => {
    await signInWithGoogle();
  };

  return (
    <div
  className="
    fixed inset-0 z-40 flex items-center justify-center 
    bg-black/50 backdrop-blur-sm
  "
  onClick={onClose}
>
  <div
    className="
      w-full max-w-sm rounded-xl 
      bg-white dark:bg-[#0F1623]
      border border-gray-200 dark:border-slate-700 
      p-6 shadow-2xl
    "
    onClick={(e) => e.stopPropagation()}
  >
    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
      {mode === "signin" ? "Sign In" : "Create Account"}
    </h2>

    {/* GOOGLE SIGN-IN BUTTON */}
    <button
      onClick={handleGoogleLogin}
      className="
        w-full flex items-center justify-center gap-3
        border border-gray-300 dark:border-slate-600
        bg-white dark:bg-slate-700
        text-gray-800 dark:text-gray-100
        font-semibold py-2 rounded-md
        hover:bg-gray-100 dark:hover:bg-slate-600
        transition-all duration-200
      "
    >
      <img
        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        alt="Google"
        className="w-5 h-5"
      />
      Sign in with Google
    </button>

    <div className="flex items-center gap-3 my-4">
      <div className="h-px bg-gray-300 dark:bg-gray-600 flex-1" />
      <span className="text-sm text-gray-600 dark:text-gray-400">OR</span>
      <div className="h-px bg-gray-300 dark:bg-gray-600 flex-1" />
    </div>

    <div className="space-y-3">

      {mode === "signup" && (
        <div>
          <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
            First Name
          </label>
          <input
            className="
              w-full px-2 py-1 rounded 
              bg-gray-50 border border-gray-300 text-gray-900
              dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100
              text-sm
            "
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
          Email
        </label>
        <input
          type="email"
          className="
            w-full px-2 py-1 rounded 
            bg-gray-50 border border-gray-300 text-gray-900
            dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100
            text-sm
          "
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
          Password
        </label>
        <input
          type="password"
          className="
            w-full px-2 py-1 rounded 
            bg-gray-50 border border-gray-300 text-gray-900
            dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100
            text-sm
          "
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
      )}

      <button
        disabled={submitting}
        onClick={onSubmit}
        className="
          w-full mt-1 px-3 py-2 rounded-md 
          bg-blue-600 hover:bg-blue-500 
          text-white font-medium text-sm 
          disabled:opacity-50
        "
      >
        {submitting ? "Processing..." : mode === "signin" ? "Sign In" : "Create Account"}
      </button>

      <button
        onClick={switchMode}
        className="text-xs text-blue-600 dark:text-blue-400 underline w-full text-center"
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>

      <button
        onClick={onClose}
        className="text-xs text-gray-600 dark:text-gray-400 w-full text-center"
      >
        Cancel
      </button>
    </div>
  </div>
</div>

  );
}
