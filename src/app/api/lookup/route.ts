import { NextResponse } from "next/server";
import { parseNumber } from "@/lib/phone";
import { lookupPrompt, parseLookup, sourcesFrom, type Lookup } from "@/lib/verdict";
import { track } from "@/lib/track";

export const runtime = "nodejs";
export const maxDuration = 60;

// Gemini with Google Search grounding researches the number. The Gemini key is
// pasted into Settings on the person's own device and sent with each check.
const MODELS = [...new Set([process.env.GEMINI_MODEL || "gemini-3.5-flash", "gemini-2.5-flash"])];
const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, Lookup>();

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[];
  error?: { message?: string; status?: string };
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { number?: string; fresh?: boolean };
  const apiKey = request.headers.get("x-gemini-key")?.trim();
  if (!apiKey) return NextResponse.json({ error: "Add your Gemini key in Settings first." }, { status: 401 });

  const number = parseNumber(body.number ?? "");
  if (number.kind === "invalid") return NextResponse.json({ error: number.label }, { status: 400 });

  const cached = cache.get(number.key);
  if (!body.fresh && cached && Date.now() - Date.parse(cached.checkedAt) < CACHE_MS) return NextResponse.json(cached);

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
        return NextResponse.json({ error: "Gemini didn't accept that key. Check it in Settings." }, { status: 401 });
      }
      if (response.status === 403) return NextResponse.json({ error: "Gemini refused that key. Check it in Settings." }, { status: 401 });
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
    await track("number_checked", { verdict: result.verdict, kind: number.kind });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: lastError }, { status: 502 });
}
