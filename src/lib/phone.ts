// Works out what kind of UK number something is, before any web search.
// Ranges follow Ofcom's National Telephone Numbering Plan.

export type NumberKind =
  | "landline"
  | "mobile"
  | "personal"
  | "pager"
  | "freephone"
  | "non-geographic"
  | "business-rate"
  | "premium"
  | "corporate"
  | "international"
  | "invalid";

export type ParsedNumber = {
  /** Digits only, UK numbers starting 0 (e.g. 02079460123); international as +CC… */
  key: string;
  /** How it's usually written, e.g. "020 7946 0123" or "+1 202 555 0143". */
  display: string;
  /** +44 form for UK numbers, for searching. */
  international: string;
  kind: NumberKind;
  /** Plain-English line about the kind of number, e.g. "UK landline · London". */
  label: string;
  /** Things worth knowing from the number alone. */
  notes: string[];
  /** Ofcom keeps this range for TV and films, so no real caller has it. */
  fictional: boolean;
};

const AREAS: [string, string][] = [
  ["020", "London"],
  ["023", "Southampton and Portsmouth"],
  ["024", "Coventry"],
  ["028", "Northern Ireland"],
  ["029", "Cardiff"],
  ["0113", "Leeds"],
  ["0114", "Sheffield"],
  ["0115", "Nottingham"],
  ["0116", "Leicester"],
  ["0117", "Bristol"],
  ["0118", "Reading"],
  ["0121", "Birmingham"],
  ["0131", "Edinburgh"],
  ["0141", "Glasgow"],
  ["0151", "Liverpool"],
  ["0161", "Manchester"],
  ["0191", "Tyneside and Sunderland"],
];

// Ofcom's ranges for drama (TV, radio, films).
const DRAMA: [string, number, number][] = [
  ["02079460", 0, 999],
  ["01134960", 0, 999],
  ["01144960", 0, 999],
  ["01154960", 0, 999],
  ["01164960", 0, 999],
  ["01174960", 0, 999],
  ["01184960", 0, 999],
  ["01214960", 0, 999],
  ["01314960", 0, 999],
  ["01414960", 0, 999],
  ["01514960", 0, 999],
  ["01614960", 0, 999],
  ["01914980", 0, 999],
  ["02890180", 0, 999],
  ["02920180", 0, 999],
  ["01632960", 0, 999],
  ["07700900", 0, 999],
  ["08081570", 0, 999],
  ["09098790", 0, 999],
  ["03069990", 0, 999],
];

const COUNTRIES: [string, string][] = [
  ["1", "USA or Canada"],
  ["7", "Russia or Kazakhstan"],
  ["20", "Egypt"],
  ["27", "South Africa"],
  ["31", "Netherlands"],
  ["32", "Belgium"],
  ["33", "France"],
  ["34", "Spain"],
  ["39", "Italy"],
  ["48", "Poland"],
  ["49", "Germany"],
  ["60", "Malaysia"],
  ["61", "Australia"],
  ["62", "Indonesia"],
  ["63", "Philippines"],
  ["86", "China"],
  ["90", "Turkey"],
  ["91", "India"],
  ["92", "Pakistan"],
  ["212", "Morocco"],
  ["216", "Tunisia"],
  ["225", "Ivory Coast"],
  ["234", "Nigeria"],
  ["254", "Kenya"],
  ["351", "Portugal"],
  ["353", "Ireland"],
  ["370", "Lithuania"],
  ["371", "Latvia"],
  ["372", "Estonia"],
  ["880", "Bangladesh"],
  ["971", "United Arab Emirates"],
  ["1441", "Bermuda"],
  ["1876", "Jamaica"],
];

function group(digits: string, sizes: number[]) {
  const parts: string[] = [];
  let i = 0;
  for (const size of sizes) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  if (i < digits.length) parts.push(digits.slice(i));
  return parts.join(" ");
}

function formatUk(n: string) {
  if (/^02/.test(n)) return group(n, [3, 4, 4]);
  if (/^01\d1/.test(n) || /^011/.test(n)) return group(n, [4, 3, 4]);
  if (/^0(1|7)/.test(n)) return group(n, [5, 6]);
  if (/^0(3|5|8|9)/.test(n)) return group(n, [4, 3, 4]);
  return n;
}

/** Pulls the first phone-number-looking run out of shared text, e.g. "Call from 07700 900123 at 10:02". */
export function findNumber(text: string): string | null {
  const match = String(text || "").match(/(?:\+|00)?\d[\d\s().-]{6,}\d/);
  return match ? match[0].trim() : null;
}

export function parseNumber(input: string): ParsedNumber {
  const raw = String(input || "").trim();
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  digits = digits.replace(/(?!^)\+/g, "");
  if (digits.startsWith("+44")) digits = "0" + digits.slice(3).replace(/^0/, "");
  else if (/^44\d{10}$/.test(digits)) digits = "0" + digits.slice(2);

  const invalid = (why: string): ParsedNumber => ({
    key: digits,
    display: raw,
    international: raw,
    kind: "invalid",
    label: why,
    notes: [],
    fictional: false,
  });

  if (digits.startsWith("+")) {
    const body = digits.slice(1);
    if (body.length < 7 || body.length > 15) return invalid("That doesn't look like a full phone number");
    const country = [...COUNTRIES].sort((a, b) => b[0].length - a[0].length).find(([code]) => body.startsWith(code));
    const code = country ? country[0] : body.slice(0, Math.min(3, body.length - 6));
    const display = `+${code} ${group(body.slice(code.length), [3, 3, 4])}`;
    return {
      key: "+" + body,
      display,
      international: display,
      kind: "international",
      label: country ? `International · ${country[1]}` : "International number",
      notes: [
        "Calls from abroad you weren't expecting are a common route for scams, including \"Wangiri\" missed calls that try to get you to ring back at a high rate.",
      ],
      fictional: false,
    };
  }

  if (!digits.startsWith("0")) {
    if (/^\d{10}$/.test(digits) && /^[1-9]/.test(digits)) digits = "0" + digits;
    else return invalid("UK numbers start with 0 or +44");
  }
  if (digits.length < 10 || digits.length > 11) return invalid("UK numbers have 10 or 11 digits");

  const display = formatUk(digits);
  const international = "+44 " + display.slice(1);
  const fictional = DRAMA.some(([prefix, lo, hi]) => {
    if (!digits.startsWith(prefix) || digits.length !== prefix.length + 3) return false;
    const tail = Number(digits.slice(prefix.length));
    return tail >= lo && tail <= hi;
  });
  const base = { key: digits, display, international, fictional };
  const notes: string[] = [];
  if (fictional) notes.push("This range is kept by Ofcom for TV and films, so it can't belong to a real caller. A real call showing it is spoofed.");

  if (/^0[12]/.test(digits)) {
    const area = AREAS.find(([prefix]) => digits.startsWith(prefix));
    notes.push("Landline numbers are easy to fake on caller ID, so a local-looking number on its own proves nothing.");
    return { ...base, kind: "landline", label: area ? `UK landline · ${area[1]}` : "UK landline · geographic number", notes };
  }
  if (/^07624/.test(digits)) return { ...base, kind: "mobile", label: "Mobile · Isle of Man", notes };
  if (/^070/.test(digits)) {
    notes.push("070 numbers look like mobiles but are \"personal numbers\" that forward elsewhere and can cost a lot to call. They are popular with scammers.");
    return { ...base, kind: "personal", label: "Personal number (070), not a mobile", notes };
  }
  if (/^076/.test(digits)) {
    notes.push("076 numbers are pagers and can be expensive to call back.");
    return { ...base, kind: "pager", label: "Pager (076)", notes };
  }
  if (/^07[1-9]/.test(digits)) return { ...base, kind: "mobile", label: "UK mobile", notes };
  if (/^080/.test(digits)) return { ...base, kind: "freephone", label: "Freephone (080)", notes };
  if (/^03/.test(digits)) {
    notes.push("03 numbers are used by public bodies, charities and companies, and cost the same as a normal landline call.");
    return { ...base, kind: "non-geographic", label: "Non-geographic (03)", notes };
  }
  if (/^08[47]/.test(digits)) {
    notes.push("084 and 087 numbers carry a service charge if you ring them.");
    return { ...base, kind: "business-rate", label: `Business rate (${digits.slice(0, 3)})`, notes };
  }
  if (/^09/.test(digits)) {
    notes.push("09 numbers are premium rate and can cost several pounds a minute. Don't ring back unless you know who it is.");
    return { ...base, kind: "premium", label: "Premium rate (09)", notes };
  }
  if (/^05/.test(digits)) {
    notes.push("05 numbers are corporate or internet-phone numbers, often used by call centres.");
    return { ...base, kind: "corporate", label: "Corporate or internet phone (05)", notes };
  }
  return invalid("That isn't a UK number range in use");
}
