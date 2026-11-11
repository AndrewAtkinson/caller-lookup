# Caller Check

Look up a UK phone number and see whether it's a scam, a nuisance caller or a genuine business.

- Works out the kind of number straight away (landline area, mobile, 070 "personal" numbers, premium rate, Ofcom TV/film ranges, international).
- Gemini with Google Search grounding then searches spam-report sites, business listings, Companies House and fraud warnings, and returns a verdict, evidence for and against, advice and sources. Only public business and spam-report information is used; private individuals' details are never looked up.
- Installable (PWA). On Android, share a number from the call log or a text to the app to check it.
- History, "Save as safe" and "Mark as scam" stay on the device.

## Setup

Checks use the `GEMINI_API_KEY` secret (shared with Smart Invoicer), limited to 200 a day and 25 per visitor. Anyone can paste their own Gemini key in **Settings** (kept on their device) to skip the limits.

Hosting: Firebase App Hosting from `main` (`apphosting.yaml`). PostHog tracking tags events with `app: caller-lookup`.

## Development

```bash
npm install
npm run dev
npm test
```
