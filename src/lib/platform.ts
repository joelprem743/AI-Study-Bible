// src/lib/platform.ts
import { Capacitor } from "@capacitor/core";

/** True inside the Android/iOS app, false in a normal browser. */
export const isNativeApp = Capacitor.isNativePlatform();

/**
 * Where the /api functions live.
 * - Web: same origin (Vercel in production, the Vite dev server locally).
 * - App: the bundled UI is served from https://localhost inside the WebView,
 *   so API calls must go to the deployed site instead.
 */
const API_ORIGIN = isNativeApp
  ? (import.meta.env.VITE_API_BASE_URL || "https://www.biblecompanions.in").replace(/\/+$/, "")
  : "";

export const apiUrl = (path: string) =>
  `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;

/** Custom URL scheme the app registers, used to come back from Google sign-in. */
export const APP_AUTH_CALLBACK = "com.joelpremtej.biblecompanion://login-callback";
