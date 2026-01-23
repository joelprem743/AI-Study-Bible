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
};



export default function ProfileMenu({
  readerSettings,
  setReaderSettings,
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
  className="
  w-10 h-10 rounded-full 
  bg-gray-100 dark:bg-gray-800
  border border-gray-300 dark:border-gray-600
  flex items-center justify-center
  text-gray-600 dark:text-gray-300
  hover:bg-gray-200 dark:hover:bg-gray-700
  hover:shadow-[0_0_6px_rgba(59,130,246,0.45)]
  dark:hover:shadow-[0_0_8px_rgba(59,130,246,0.5)]
  transition
"

>
  <i className="fas fa-user text-lg" />
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
  };
  
  const updateSettings = (patch: Partial<ReaderSettings>) => {
    setReaderSettings({
      ...settings,
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
  className="
  w-10 h-10 rounded-full 
  bg-gray-100 dark:bg-gray-700
  border border-gray-300 dark:border-gray-600
  flex items-center justify-center
  font-semibold
  text-gray-800 dark:text-white
  hover:bg-gray-200 dark:hover:bg-gray-600
  hover:shadow-[0_0_6px_rgba(59,130,246,0.45)]
  dark:hover:shadow-[0_0_8px_rgba(59,130,246,0.5)]
  transition
"

>
  {firstLetter}
</button>





      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div
          className="
            absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-50
            bg-white dark:bg-slate-900
            border border-gray-200 dark:border-slate-700
            divide-y divide-gray-200 dark:divide-slate-700
          "
        >
          <button
            onClick={() => {
              setIsHighlightsOpen(true);
              setIsDropdownOpen(false);
            }}
            className="
              w-full text-left px-4 py-2 text-sm
              text-gray-700 dark:text-gray-200
              hover:bg-gray-100 dark:hover:bg-slate-800
            "
          >
            My Highlights
          </button>

          <button
            onClick={() => {
              setIsNotesOpen(true);
              setIsDropdownOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm
                       text-gray-700 dark:text-gray-200
                       hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            My Notes
          </button>

          <button
  onClick={() => setLanguage(language === "EN" ? "TE" : "EN")}
  className="
    w-full text-left px-4 py-2 text-sm
    text-gray-700 dark:text-gray-200
    hover:bg-gray-100 dark:hover:bg-slate-800
    flex items-center justify-between
  "
>
  <span>Language</span>
  <span className="font-semibold">{language}</span>
</button>


            
<button
  onClick={() => {
    setIsDropdownOpen(false);
    setIsReaderSettingsOpen(true);
  }}
  className="
    w-full text-left px-4 py-2 text-sm
    text-gray-700 dark:text-gray-200
    hover:bg-gray-100 dark:hover:bg-slate-800
  "
>
  Reader Settings
</button>




          <button
            onClick={handleLogout}
            className="
              w-full text-left px-4 py-2 text-sm
              text-red-600 dark:text-red-400
              hover:bg-red-50 dark:hover:bg-red-900/20
            "
          >
            Logout
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
    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
    onClick={() => setIsReaderSettingsOpen(false)}
  >
    <div
      className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-5 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Reader Settings
      </h2>

      {/* FONT SIZE */}
      <div className="mb-4">
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
          Font Size
        </label>

        <select
  value={settings.fontSize}
  onChange={(e) => {
    const value = e.target.value as FontSize;
    updateSettings({ fontSize: value });
  }}
  className="w-full p-2 rounded border dark:bg-gray-800 dark:border-slate-700"
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
  className="w-full"
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
    });
  }}
  className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 text-sm"
>
  Reset
</button>


        <button
          onClick={() => setIsReaderSettingsOpen(false)}
          className="px-3 py-2 rounded bg-blue-600 text-white text-sm"
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
