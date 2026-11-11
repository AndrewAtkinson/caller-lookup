# Caller Check

Look up a UK phone number and see whether it's a scam, a nuisance caller or a genuine business.

- Works out the kind of number straight away (landline area, mobile, 070 "personal" numbers, premium rate, Ofcom TV/film ranges, international).
- Gemini with Google Search grounding then searches spam-report sites, business listings, Companies House and fraud warnings, and returns a verdict, evidence for and against, advice and sources. Only public business and spam-report information is used; private individuals' details are never looked up.
- Installable (PWA). On Android, share a number from the call log or a text to the app to check it.
- History, "Save as safe" and "Mark as scam" stay on the device.

## Setup

The Gemini key is pasted into **Settings** in the app and kept on that device. No secrets are needed on the server.

Hosting: Firebase App Hosting from `main` (`apphosting.yaml`). PostHog tracking tags events with `app: caller-lookup`.

## Development

```bash
npm install
npm run dev
npm test
```
