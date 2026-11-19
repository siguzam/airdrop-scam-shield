import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAI, GoogleAIBackend } from "firebase/ai";

/**
 * Firebase web config. Fill it from your own Firebase project:
 * Firebase console -> Project settings -> Your apps -> Web app.
 * Copy `.env.example` to `.env.local` and set the VITE_FIREBASE_* values.
 * These values are public identifiers for the web app, not private secrets,
 * but they still live in .env.local and stay out of git.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let ai: FirebaseAI | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);

  if (import.meta.env.DEV) {
    // Local development: use the App Check debug provider. On first run the
    // SDK prints a debug token to the browser console. Register that token in
    // Firebase console -> App Check -> Manage debug tokens. Never enable the
    // debug token in a production build.
    (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  }

  const siteKey =
    (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined) ?? "";
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey || "PLACEHOLDER_RECAPTCHA_SITE_KEY"),
    isTokenAutoRefreshEnabled: true,
  });

  ai = getAI(app, { backend: new GoogleAIBackend() });
}

export function getFirebaseAI(): FirebaseAI {
  if (!ai) {
    throw new Error(
      "Firebase is not configured. Copy .env.example to .env.local and fill in your Firebase web app values, then restart the dev server.",
    );
  }
  return ai;
}
