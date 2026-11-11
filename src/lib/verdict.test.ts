import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLookup, lookupPrompt, sourcesFrom } from "./verdict.ts";
import { parseNumber } from "./phone.ts";

test("reads Gemini's answer", () => {
  const r = parseLookup(`**VERDICT:** SCAM
CONFIDENCE: 92
WHO: Unknown
TYPE: Fake HMRC tax call
SUMMARY: People say the caller claims to be HMRC [1, 2].
REPORTS: 1,038
FOR:
- None found
AGAINST:
- 38 reports on Who Called Me
- Not on HMRC's contact page
ADVICE: Hang up and don't ring back.`);
  assert.ok(r);
  assert.equal(r.verdict, "scam");
  assert.equal(r.confidence, 92);
  assert.equal(r.callerType, "Fake HMRC tax call");
  assert.equal(r.summary, "People say the caller claims to be HMRC.");
  assert.equal(r.reports, 1038);
  assert.deepEqual(r.evidenceFor, []);
  assert.deepEqual(r.evidenceAgainst, ["38 reports on Who Called Me", "Not on HMRC's contact page"]);
  assert.equal(r.advice, "Hang up and don't ring back.");
});

test("no verdict means no answer, unknown is capped", () => {
  assert.equal(parseLookup("I couldn't find anything."), null);
  assert.equal(parseLookup("VERDICT: UNKNOWN\nCONFIDENCE: 90")?.confidence, 60);
});

test("prompt has every written form and the privacy rule", () => {
  const p = lookupPrompt(parseNumber("07912 345678"), "2026-11-11");
  for (const f of ['"07912 345678"', '"07912345678"', '"+44 7912 345678"', '"+447912345678"']) assert.ok(p.includes(f), f);
  assert.match(p, /Private number/);
});

test("sources are de-duplicated", () => {
  const s = sourcesFrom([
    { web: { uri: "https://a.example/x", title: "who-called.co.uk" } },
    { web: { uri: "https://a.example/y", title: "who-called.co.uk" } },
    { web: { uri: "https://b.example/z", title: "" } },
    {},
  ]);
  assert.deepEqual(s, [
    { title: "who-called.co.uk", url: "https://a.example/x" },
    { title: "b.example", url: "https://b.example/z" },
  ]);
});
