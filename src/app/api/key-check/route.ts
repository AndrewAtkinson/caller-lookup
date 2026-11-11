import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Checks a Gemini key works (by listing models, which costs nothing) before it's saved.
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-gemini-key")?.trim();
  if (!apiKey) return NextResponse.json({ ok: false, error: "Paste a key first." }, { status: 400 });
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
    headers: { "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) return NextResponse.json({ ok: false, error: "Couldn't reach Gemini. Try again." }, { status: 502 });
  if (!response.ok) return NextResponse.json({ ok: false, error: "Gemini didn't accept that key." }, { status: 401 });
  return NextResponse.json({ ok: true });
}
