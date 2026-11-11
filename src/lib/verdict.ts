import type { ParsedNumber } from "./phone.ts";

export type VerdictKind = "scam" | "spam" | "legit" | "unknown";

export type Source = { title: string; url: string };

export type Lookup = {
  number: ParsedNumber;
  verdict: VerdictKind;
  /** 0–100. */
  confidence: number;
  /** Organisation name, or "Unknown" / "Private number". */
  who: string;
  /** What kind of caller it is, e.g. "Dental practice" or "Fake HMRC tax call". */
  callerType: string;
  summary: string;
  reports: number;
  evidenceFor: string[];
  evidenceAgainst: string[];
  advice: string;
  sources: Source[];
  checkedAt: string;
  model?: string;
};

export const VERDICT_LABEL: Record<VerdictKind, string> = {
  scam: "Likely scam",
  spam: "Nuisance / sales",
  legit: "Legit business",
  unknown: "Not enough info",
};

export function lookupPrompt(number: ParsedNumber, today = new Date().toISOString().slice(0, 10)) {
  const forms = [...new Set([number.display, number.key, number.international, number.international.replace(/\s/g, "")])];
  return `You help people in the UK decide whether to trust a phone number that called them. Today is ${today}.

Search the web for this phone number, trying each written form: ${forms.map((f) => `"${f}"`).join(", ")}.
What the number itself tells us: ${number.label}.${number.notes.length ? " " + number.notes.join(" ") : ""}

Look at:
- UK spam-report and "who called me" sites (for example Who Called Me, Tellows, ShouldIAnswer, Sync.me), and what people reported: how many reports, what the caller said, what they wanted.
- Official websites, Google business listings, Companies House, gov.uk, NHS, bank and utility contact pages that list this exact number.
- Fraud warnings (Action Fraud, Which?, Ofcom, banks, news) that mention it.

Rules:
- Only use public information about businesses, organisations and spam reports.
- If the number seems to belong to a private person (not a business), do not give their name, address or any personal detail. Set WHO to "Private number" and say only that it looks like a personal phone.
- A business name in a search result only counts if the page shows this exact number.
- Scammers often spoof real numbers. If a real organisation's number is being reported for scam calls, say so.
- Don't guess. If you find little or nothing, say UNKNOWN.

VERDICT meanings: SCAM = fraud, impersonation, phishing or trying to get money or details. SPAM = unwanted sales, surveys, robocalls or claims companies that are not fraud. LEGIT = a real organisation that lists this number, with no pattern of abuse. UNKNOWN = not enough to tell.

Answer in exactly this plain-text format, with no other text and no markdown:
VERDICT: SCAM or SPAM or LEGIT or UNKNOWN
CONFIDENCE: a whole number from 0 to 100
WHO: the organisation's name, or Unknown, or Private number
TYPE: a few words on what kind of caller it is, e.g. Dental practice, Fake HMRC tax call, Energy sales calls
SUMMARY: one or two short sentences in plain English
REPORTS: how many spam or scam reports you found in total, as a number (0 if none)
FOR:
- one piece of evidence that it is a genuine caller, per line, up to 4
AGAINST:
- one piece of evidence that it is spam or a scam, per line, up to 4
ADVICE: one sentence telling the person what to do`;
}

function clean(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/\s*\[\d+(?:,\s*\d+)*\]/g, "")
    .replace(/\[cite:[^\]]*\]/gi, "")
    .trim();
}

export function parseLookup(text: string): Omit<Lookup, "number" | "sources" | "checkedAt" | "model"> | null {
  const out = {
    verdict: "unknown" as VerdictKind,
    confidence: 0,
    who: "Unknown",
    callerType: "",
    summary: "",
    reports: 0,
    evidenceFor: [] as string[],
    evidenceAgainst: [] as string[],
    advice: "",
  };
  let list: string[] | null = null;
  let sawVerdict = false;
  for (const rawLine of String(text || "").split("\n")) {
    const line = clean(rawLine.replace(/^#+\s*/, ""));
    if (!line) continue;
    const field = line.match(/^([A-Z]+):\s*(.*)$/);
    if (field) {
      const [, name, value] = field;
      list = null;
      switch (name) {
        case "VERDICT": {
          const v = value.toLowerCase();
          const kind = (["scam", "spam", "legit", "unknown"] as const).find((k) => v.startsWith(k));
          if (kind) {
            out.verdict = kind;
            sawVerdict = true;
          }
          break;
        }
        case "CONFIDENCE":
          out.confidence = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
          break;
        case "WHO":
          out.who = value.slice(0, 120) || "Unknown";
          break;
        case "TYPE":
          out.callerType = value.slice(0, 120);
          break;
        case "SUMMARY":
          out.summary = value.slice(0, 600);
          break;
        case "REPORTS":
          out.reports = Math.max(0, parseInt(value.replace(/,/g, ""), 10) || 0);
          break;
        case "FOR":
          list = out.evidenceFor;
          break;
        case "AGAINST":
          list = out.evidenceAgainst;
          break;
        case "ADVICE":
          out.advice = value.slice(0, 400);
          break;
      }
      continue;
    }
    const item = line.match(/^[-*•]\s+(.+)$/)?.[1]?.trim();
    if (list && item && !/^(none|nothing|no evidence|n\/a)\b/i.test(item) && list.length < 4) list.push(item.slice(0, 300));
  }
  if (!sawVerdict) return null;
  if (out.verdict === "unknown" && out.confidence > 60) out.confidence = 60;
  return out;
}

type GroundingChunk = { web?: { uri?: string; title?: string } };

export function sourcesFrom(chunks: GroundingChunk[] | undefined): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const chunk of chunks || []) {
    const url = chunk.web?.uri;
    const title = chunk.web?.title || "";
    if (!url || seen.has(title || url)) continue;
    seen.add(title || url);
    sources.push({ title: title || new URL(url).hostname, url });
    if (sources.length >= 8) break;
  }
  return sources;
}
