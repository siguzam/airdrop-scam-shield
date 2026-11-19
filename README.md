# Airdrop Scam Shield

Paste an airdrop message, a link, or a BSC contract address and get an
instant risk verdict: a score from 0 to 100, a verdict of SAFE, SUSPICIOUS,
or DANGER, a list of red flags in plain language, and what to do next.

Built for the **#BuildHybridAI 2026** hackathon on Devpost.

## Why hybrid AI

Crypto scams move fast and most victims meet them on their phone, often
offline or on a slow connection. Airdrop Scam Shield answers in three
stages, each running where it makes the most sense.

| Stage | Where it runs | Why there |
| --- | --- | --- |
| 1. Instant pre-check | In the browser, no network | Deterministic pattern matching (seed phrase requests, send-to-get doubling, fake verification, urgency tricks) answers in milliseconds and costs nothing. |
| 2. Quick triage | On-device with Gemini Nano via Firebase AI Logic (`PREFER_ON_DEVICE`) | Private, free, and works offline. The model judges the message with a single-turn structured JSON prompt. If the device has no on-device model, the app falls back to the free Gemini Developer API in the cloud. |
| 3. Deep analysis | In the cloud with Gemini via the free Gemini Developer API (REST, `gemini-2.0-flash`) | Only runs when the user clicks for it. If the input holds a BSC contract address, the app first reads live on-chain facts (source verification, token data, DEX liquidity) and feeds them to the strongest model. No Firebase AI Logic cloud, no paid plan. |

The result card always shows a prominent badge with the real source of
the answer: **ON_DEVICE** (Gemini Nano, answered privately on this
device) or **IN_CLOUD** (free Gemini Developer API cloud fallback). That
badge is the core of the hybrid story: the same prompt shape, and the
runtime decides where the work happens — on-device first, free cloud
when the device cannot do it.

On-device inference works on Chrome Desktop v139 and newer and covers
single-turn text generation, including structured JSON output.

## Features

- Risk score 0-100, verdict, red flags with plain explanations, next steps.
- Stage 1 local pre-check: 11 deterministic rules for classic scam patterns.
- Stage 2 quick triage with `InferenceMode.PREFER_ON_DEVICE` and structured
  JSON output. The on-device model is warmed up with
  `initializeDeviceModel` after the user clicks Scan, with a progress bar.
  If the device has no on-device model, triage falls back to the free
  Gemini Developer API (`gemini-2.0-flash`, direct REST call).
- Stage 3 deep analysis with the free Gemini Developer API
  (`gemini-2.0-flash`), on user click. When a BSC address is present, the
  app fetches read-only on-chain facts from public BSC RPCs (with
  fallbacks), checks source verification on Sourcify, and reads trading
  pairs and liquidity from DexScreener.
- Scan history saved in `localStorage`. No backend beyond Firebase (App
  Check) and the free Gemini Developer API.
- Clean, fast, mobile-friendly UI in English.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

Stage 1 works with no setup at all. Stage 2 on-device needs a Firebase
project (see below); the cloud fallback needs a free Gemini Developer API
key (see below). Without either, the app runs in demo mode and says so
clearly.

## Add your Firebase config

1. In the Firebase console, create a project (or reuse one) and register a
   Web app. Enable **Firebase AI Logic** for the project. (The project for
   this submission already exists: `airdrop-scam-shield`.)
2. In the Firebase console, go to **App Check** and register a reCAPTCHA v3
   provider. Copy the site key.
3. Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_RECAPTCHA_SITE_KEY=...
```

4. Restart the dev server.

## Add your free Gemini Developer API key (cloud fallback)

The cloud fallback (and deep analysis) call the Gemini Developer API
directly — no Firebase AI Logic cloud, no paid Blaze plan.

1. Get a free key at Google AI Studio: https://aistudio.google.com
   (create an API key; the free tier is enough for this demo).
2. In `.env.local`, set:

```env
VITE_GEMINI_API_KEY=your-gemini-developer-api-key
```

3. Restart the dev server (or rebuild for a hosted demo).

The key is a browser-side key, so for a public demo restrict it in
Google AI Studio (API restrictions: Generative Language API only, and an
HTTP referrer restriction to your demo domain).

## Register the App Check debug token (local dev)

App Check is enforced, so local development uses a debug token:

1. Run the app with `npm run dev` and open it in Chrome.
2. Click **Scan now**. The browser console prints a debug token.
3. In the Firebase console, go to **App Check -> Manage debug tokens** and
   add that token.
4. Reload the page. AI calls now pass App Check.

Never enable the debug token in a production build. For a hosted demo, use
the real reCAPTCHA v3 site key instead.

## Build

```bash
npm run build
npm run preview
```

## Project structure

```text
src/
  main.tsx          Entry point
  App.tsx           Scanner UI and stage orchestration
  firebase.ts       Firebase app, App Check, Firebase AI setup
  ai.ts             Hybrid model helpers (warmup, triage, deep analysis)
  scan.ts           Stage 1 rules, BSC address helpers, on-chain fetchers
  history.ts        localStorage scan history
  types.ts          Shared types
  components/
    HybridBadge.tsx   Prominent ON_DEVICE / IN_CLOUD badge
    VerdictCard.tsx   Score, verdict, summary
    FlagsList.tsx     Red flag list
    OnChainCard.tsx   BSC facts card
    HistoryPanel.tsx  Scan history list
  styles.css
```

## Tech

- Vite + React + TypeScript
- `firebase` v13 (`firebase/ai`: `getAI`, `getGenerativeModel`,
  `GoogleAIBackend`, `InferenceMode`) for on-device Gemini Nano
- Gemini Developer API (`gemini-2.0-flash`) via direct `fetch` for the
  free cloud fallback and deep analysis
- Firebase App Check (reCAPTCHA v3, debug token in dev)
- Public BSC RPCs, Sourcify API, DexScreener API (read-only)

## License

Apache License 2.0. See `LICENSE`.

## Disclaimer

Airdrop Scam Shield is an educational demo. It is not financial advice and
it cannot guarantee that a message is safe. Always verify through official
channels before connecting a wallet or sending funds.
