//src/context/AuthContext
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";

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
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      },
    });
  };
  
  
  
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
