import { NextResponse } from "next/server";
import { parseNumber } from "@/lib/phone";
import { lookupPrompt, parseLookup, sourcesFrom, type Lookup } from "@/lib/verdict";
import { track } from "@/lib/track";

export const runtime = "nodejs";
export const maxDuration = 60;

// Gemini with Google Search grounding researches the number. Checks use the app's
// own key (GEMINI_API_KEY secret), with daily limits so a public site can't run up
// a bill. Someone can also paste their own key in Settings, which skips the limits.
const DAILY_TOTAL = Number(process.env.DAILY_CHECKS || 200);
const DAILY_PER_VISITOR = Number(process.env.DAILY_CHECKS_PER_VISITOR || 25);
const usage = { day: "", total: 0, byVisitor: new Map<string, number>() };

function allowServerCheck(visitor: string): string | null {
  const day = new Date().toISOString().slice(0, 10);
  if (usage.day !== day) Object.assign(usage, { day, total: 0, byVisitor: new Map() });
  const mine = usage.byVisitor.get(visitor) ?? 0;
  if (mine >= DAILY_PER_VISITOR) return "You've used today's free checks. Add your own Gemini key in Settings to keep going.";
  if (usage.total >= DAILY_TOTAL) return "The app has used today's checks. Add your own Gemini key in Settings to keep going.";
  usage.total += 1;
  usage.byVisitor.set(visitor, mine + 1);
  return null;
}
const MODELS = [...new Set([process.env.GEMINI_MODEL || "gemini-3.5-flash", "gemini-2.5-flash"])];
const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, Lookup>();

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[];
  error?: { message?: string; status?: string };
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { number?: string; fresh?: boolean };
  const ownKey = request.headers.get("x-gemini-key")?.trim();
  const apiKey = ownKey || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Add your Gemini key in Settings first." }, { status: 401 });

  const number = parseNumber(body.number ?? "");
  if (number.kind === "invalid") return NextResponse.json({ error: number.label }, { status: 400 });

  const cached = cache.get(number.key);
  if (!body.fresh && cached && Date.now() - Date.parse(cached.checkedAt) < CACHE_MS) return NextResponse.json(cached);

  if (!ownKey) {
    const visitor = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const refused = allowServerCheck(visitor);
    if (refused) return NextResponse.json({ error: refused }, { status: 429 });
  }

  let lastError = "Couldn't reach Gemini. Try again in a minute.";
  for (const model of MODELS) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: lookupPrompt(number) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(50_000),
    }).catch(() => null);
    if (!response) continue;
    const data = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      if (response.status === 400 && /api key/i.test(data.error?.message ?? "")) {
        return NextResponse.json({ error: ownKey ? "Gemini didn't accept that key. Check it in Settings." : "The app's Gemini key isn't working. Add your own in Settings for now." }, { status: 401 });
      }
      if (response.status === 403) return NextResponse.json({ error: ownKey ? "Gemini refused that key. Check it in Settings." : "The app's Gemini key isn't working. Add your own in Settings for now." }, { status: 401 });
      if (response.status === 429) lastError = "Your Gemini key has hit its limit for now. Try again shortly.";
      continue;
    }
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = parseLookup(text);
    if (!parsed) continue;
    const result: Lookup = {
      ...parsed,
      number,
      sources: sourcesFrom(candidate?.groundingMetadata?.groundingChunks),
      checkedAt: new Date().toISOString(),
      model,
    };
    if (number.fictional && result.verdict === "unknown") {
      result.summary = result.summary || "This number is in a range kept for TV and films, so any real call from it was spoofed.";
    }
    cache.set(number.key, result);
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    await track("number_checked", { verdict: result.verdict, kind: number.kind, own_key: Boolean(ownKey) });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: lastError }, { status: 502 });
}
