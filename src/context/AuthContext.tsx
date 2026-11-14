//src/context/AuthContext
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNativeApp, APP_AUTH_CALLBACK } from "../lib/platform";

interface AuthContextType {
  user: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (
    email: string,
    password: string,
    metadata?: Record<string, any>
  ) => Promise<any>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<any>;

  // ✅ ADD THESE
  language: "EN" | "TE";
  setLanguage: (lang: "EN" | "TE") => void;
  bibleVersion: string;
  setBibleVersion: (v: string) => void;
}



const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load session on initial page load
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes (login, logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };
  const [bibleVersion, setBibleVersion] = useState(
    localStorage.getItem("bible_version") || "KJV"
  );
  
  useEffect(() => {
    localStorage.setItem("bible_version", bibleVersion);
  }, [bibleVersion]);
  

  const [language, setLanguage] = useState<"EN" | "TE">(
    (localStorage.getItem("ui_language") as "EN" | "TE") || "EN"
  );
  
  useEffect(() => {
    localStorage.setItem("ui_language", language);
  }, [language]);
  
  
  const signInWithGoogle = async () => {
    if (isNativeApp) {
      // Google blocks sign-in inside app WebViews, so open the system browser
      // and come back through the app's custom URL scheme (handled below).
      const result = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: APP_AUTH_CALLBACK,
          skipBrowserRedirect: true,
        },
      });
      if (!result.error && result.data?.url) {
        await Browser.open({ url: result.data.url });
      }
      return result;
    }

    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      },
    });
  };

  // App only: finish Google sign-in when the browser redirects back to the app.
  useEffect(() => {
    if (!isNativeApp) return;

    const listener = CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(APP_AUTH_CALLBACK)) return;

      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get("code");
        const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      } catch (err) {
        console.error("Google sign-in callback failed:", err);
      } finally {
        Browser.close().catch(() => {});
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, []);
  
  
  
  const signUp = async (
    email: string,
    password: string,
    metadata?: Record<string, any>
  ) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
  };
  

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut,signInWithGoogle,language,setLanguage,bibleVersion,
      setBibleVersion, }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
};
