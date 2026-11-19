# Airdrop Scam Shield — Devpost Submission Draft

## Tagline

Paste an airdrop message, link, or token contract. Get an instant, checkable scam verdict — on-device first, cloud when needed.

## Description (for the Devpost text field)

Airdrop Scam Shield helps crypto users spot scam airdrops before they connect a wallet or send funds.

Paste a Telegram or X airdrop message, a link, or a BSC token contract address. The app returns a risk score from 0 to 100, a verdict of SAFE, SUSPICIOUS, or DANGER, a list of red flags with plain explanations, and the next steps to stay safe.

It is built on Firebase AI Logic hybrid inference:

- Instant local pre-checks catch classic scam patterns with no network and no data leaving the device.
- Quick triage runs on-device with Gemini Nano through Firebase AI Logic in PREFER_ON_DEVICE mode. It is free, private, and works offline. The result screen shows a clear ON_DEVICE badge so the user knows where the answer came from.
- When the device cannot run the model, the same call falls back to the cloud model automatically, and the badge shows IN_CLOUD.
- Deep analysis first fetches read-only on-chain facts (contract verification, trading pair and liquidity) and then asks the cloud model, so the verdict is grounded in checkable facts, not just model output.

Firebase App Check protects the AI Logic calls, with the debug provider for local development. The app is a single-page web app (Vite + React + TypeScript) with scan history stored locally in the browser.

## Built with

Firebase AI Logic (hybrid on-device + cloud inference, Gemini Nano, Gemini cloud models), Firebase App Check, Vite, React, TypeScript.

## Links to fill in before submitting

- Live demo URL: (deploy URL from the main chat)
- Public repo: https://github.com/siguzam/airdrop-scam-shield
- Demo video (YouTube, max 3 minutes): (upload link)
- License: Apache-2.0
