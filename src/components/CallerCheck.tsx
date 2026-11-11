"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { findNumber, parseNumber, type ParsedNumber } from "@/lib/phone";
import { VERDICT_LABEL, type Lookup, type VerdictKind } from "@/lib/verdict";

type Mark = "safe" | "scam";
type Saved = Lookup & { mark?: Mark };
type View = { name: "home" } | { name: "settings" } | { name: "result"; key: string };

const KEY_STORE = "cc_gemini_key";
const HISTORY_STORE = "cc_history";

const COLOR: Record<VerdictKind, string> = {
  scam: "var(--scam)",
  spam: "var(--spam)",
  legit: "var(--legit)",
  unknown: "var(--unknown)",
};
const BADGE: Record<VerdictKind, string> = { scam: "SCAM", spam: "SPAM", legit: "OK", unknown: "?" };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function shownVerdict(s: Saved): VerdictKind {
  if (s.mark === "safe") return "legit";
  if (s.mark === "scam") return "scam";
  return s.verdict;
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const Icon = {
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
  ),
  gear: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
  ),
};

export default function CallerCheck() {
  const [view, setView] = useState<View>({ name: "home" });
  const [apiKey, setApiKey] = useState("");
  const [history, setHistory] = useState<Saved[]>([]);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<"all" | VerdictKind>("all");
  const [pending, setPending] = useState<ParsedNumber | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const saveHistory = useCallback((next: Saved[]) => {
    setHistory(next);
    write(HISTORY_STORE, next.slice(0, 100));
  }, []);

  const check = useCallback(
    async (raw: string, fresh = false) => {
      const number = parseNumber(raw);
      setError("");
      if (number.kind === "invalid") {
        setError(number.label);
        return;
      }
      const key = read<string>(KEY_STORE, "");
      if (!key) {
        setError("Add your Gemini key in Settings first.");
        setView({ name: "settings" });
        return;
      }
      setPending(number);
      setView({ name: "result", key: number.key });
      try {
        const response = await fetch("/api/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-gemini-key": key },
          body: JSON.stringify({ number: raw, fresh }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Something went wrong.");
        const result = data as Lookup;
        const current = read<Saved[]>(HISTORY_STORE, []);
        const previous = current.find((h) => h.number.key === result.number.key);
        saveHistory([{ ...result, mark: previous?.mark }, ...current.filter((h) => h.number.key !== result.number.key)]);
        setView((v) => (v.name === "result" && v.key === number.key ? { name: "result", key: result.number.key } : v));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setPending(null);
      }
    },
    [saveHistory],
  );

  // Load saved key and history, then check a number that was shared to the app or linked (?n=…).
  useEffect(() => {
    setApiKey(read<string>(KEY_STORE, ""));
    setHistory(read<Saved[]>(HISTORY_STORE, []));
    setReady(true);
    const params = new URLSearchParams(location.search);
    const shared = params.get("n") || findNumber([params.get("text"), params.get("title"), params.get("url")].filter(Boolean).join(" "));
    if (shared) {
      window.history.replaceState(null, "", "/");
      setInput(shared);
      void check(shared);
    }
  }, [check]);

  // Phone back button goes back to the list, not out of the app.
  useEffect(() => {
    if (view.name === "home") return;
    window.history.pushState({ cc: true }, "");
    const onPop = () => setView({ name: "home" });
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [view.name]);

  const goHome = () => {
    setError("");
    if (window.history.state?.cc) window.history.back();
    else setView({ name: "home" });
  };

  const setMark = (key: string, mark: Mark | undefined) =>
    saveHistory(history.map((h) => (h.number.key === key ? { ...h, mark: h.mark === mark ? undefined : mark } : h)));

  const remove = (key: string) => {
    saveHistory(history.filter((h) => h.number.key !== key));
    goHome();
  };

  const shown = useMemo(() => (filter === "all" ? history : history.filter((h) => shownVerdict(h) === filter)), [history, filter]);

  if (view.name === "settings")
    return (
      <Settings
        apiKey={apiKey}
        onSave={(k) => {
          write(KEY_STORE, k);
          setApiKey(k);
          setError("");
        }}
        onBack={goHome}
        onClear={() => saveHistory([])}
        count={history.length}
      />
    );

  if (view.name === "result") {
    const saved = history.find((h) => h.number.key === view.key);
    return (
      <Result
        saved={pending ? undefined : saved}
        pending={pending}
        error={error}
        onBack={goHome}
        onAgain={() => void check(saved?.number.display ?? pending?.display ?? "", true)}
        onMark={(m) => saved && setMark(saved.number.key, m)}
        onRemove={() => saved && remove(saved.number.key)}
      />
    );
  }

  return (
    <main className="shell">
      <div className="top">
        <div className="grow kicker mono">CALLER CHECK</div>
        <button className="icon-btn" aria-label="Settings" onClick={() => setView({ name: "settings" })}>{Icon.gear}</button>
      </div>
      <div>
        <h1>Who just called?</h1>
        <p className="lede">Type or paste a number. We search spam reports, business listings and fraud warnings, then show what we found.</p>
      </div>
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          void check(input);
        }}
      >
        <label htmlFor="number" className="sr">Phone number</label>
        <input id="number" inputMode="tel" autoComplete="off" placeholder="07… or +44…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn primary big" type="submit">Check</button>
      </form>
      {ready && !apiKey && (
        <div className="card">
          <div className="label">One-time setup</div>
          <p className="body">Caller Check uses your own free Gemini key to search the web. It stays on this phone.</p>
          <button className="btn primary" onClick={() => setView({ name: "settings" })}>Add Gemini key</button>
        </div>
      )}
      {error && <div className="card error" role="alert">{error}</div>}
      {history.length > 0 && (
        <>
          <div className="chips" role="group" aria-label="Show">
            {(["all", "scam", "spam", "legit", "unknown"] as const).map((f) => (
              <button key={f} className={`chip ${filter === f ? "on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "legit" ? "Safe" : f === "unknown" ? "Unsure" : f === "scam" ? "Scams" : "Spam"}
              </button>
            ))}
          </div>
          <div className="label">Your checks</div>
          <div className="list">
            {shown.map((h) => {
              const v = shownVerdict(h);
              return (
                <button key={h.number.key} className="item" onClick={() => setView({ name: "result", key: h.number.key })}>
                  <span className="badge" style={{ background: COLOR[v] }}>{h.mark ? (h.mark === "safe" ? "SAFE" : "SCAM") : BADGE[v]}</span>
                  <span className="main">
                    <span className="num mono">{h.number.display}</span>
                    <span className="sub">{[h.who !== "Unknown" ? h.who : "", h.callerType].filter(Boolean).join(" · ") || VERDICT_LABEL[h.verdict]}{h.reports ? ` · ${h.reports} reports` : ""}</span>
                  </span>
                  <span className="when">{ago(h.checkedAt)}</span>
                </button>
              );
            })}
            {shown.length === 0 && <div className="empty">Nothing here yet.</div>}
          </div>
        </>
      )}
      {ready && history.length === 0 && apiKey && <div className="empty">Numbers you check show up here, so you can spot repeat callers.</div>}
      <p className="foot">Only public business listings and spam reports are searched. Results can be wrong; if in doubt, don&apos;t ring back and contact the organisation on a number you trust.</p>
    </main>
  );
}

function Result({
  saved,
  pending,
  error,
  onBack,
  onAgain,
  onMark,
  onRemove,
}: {
  saved?: Saved;
  pending: ParsedNumber | null;
  error: string;
  onBack: () => void;
  onAgain: () => void;
  onMark: (m: Mark) => void;
  onRemove: () => void;
}) {
  const number = saved?.number ?? pending;
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!pending) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, 3)), 3500);
    return () => clearInterval(t);
  }, [pending]);

  const [shared, setShared] = useState(false);
  const share = async () => {
    if (!saved) return;
    const text = `${saved.number.display}: ${VERDICT_LABEL[saved.verdict]}${saved.who !== "Unknown" ? ` (${saved.who})` : ""}. ${saved.summary}`;
    const url = `${location.origin}/?n=${encodeURIComponent(saved.number.key)}`;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShared(true);
      }
    } catch {}
  };

  const date = new Date(saved?.checkedAt ?? Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
  const v = saved ? shownVerdict(saved) : "unknown";

  return (
    <main className="shell">
      <div className="top">
        <button className="icon-btn" aria-label="Back" onClick={onBack}>{Icon.back}</button>
        <div className="grow kicker mono">CASE FILE · {date}</div>
      </div>
      {number && (
        <div>
          <div className="number mono">{number.display}</div>
          <div className="lede" style={{ marginTop: 6 }}>{number.label}</div>
        </div>
      )}

      {pending && (
        <div className="card" aria-live="polite">
          <div className="label pulse">Investigating…</div>
          <div className="steps">
            {["Searching spam-report sites", "Looking for business listings", "Checking fraud warnings", "Weighing up the evidence"].map((s, i) => (
              <div key={s} className={i < step ? "done" : i === step ? "pulse" : ""} style={i > step ? { opacity: 0.4 } : undefined}>
                {i < step ? "✓" : "·"} {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && !pending && (
        <div className="card error" role="alert">
          {error}
          <button className="btn" onClick={onAgain}>Try again</button>
        </div>
      )}

      {saved && !pending && (
        <>
          <div className="chips">
            <span className="chip verdict" style={{ background: COLOR[v] }}>{saved.mark === "safe" ? "You marked safe" : saved.mark === "scam" ? "You marked scam" : VERDICT_LABEL[saved.verdict]}</span>
            <span className="chip">Confidence {saved.confidence}%</span>
            <span className="chip">{saved.reports === 1 ? "1 report" : `${saved.reports} reports`}</span>
          </div>
          <div className="meter" aria-hidden="true"><div style={{ width: `${saved.confidence}%`, background: COLOR[saved.verdict] }} /></div>

          <div className="card">
            <div className="label">Who it is</div>
            <div className="who">{saved.who}</div>
            {saved.callerType && <div className="kicker">{saved.callerType}</div>}
            {saved.summary && <p className="body">{saved.summary}</p>}
          </div>

          {saved.advice && (
            <div className="card" style={{ borderColor: COLOR[saved.verdict] }}>
              <div className="label">What to do</div>
              <p className="body" style={{ color: "var(--text)" }}>{saved.advice}</p>
            </div>
          )}

          {(saved.evidenceFor.length > 0 || saved.evidenceAgainst.length > 0) && (
            <div className="card">
              <div className="label">Evidence</div>
              {saved.evidenceFor.map((e) => (
                <div className="ev" key={"f" + e}><span className="sign mono" style={{ color: "var(--legit)" }} aria-label="For">+</span><span>{e}</span></div>
              ))}
              {saved.evidenceAgainst.map((e) => (
                <div className="ev" key={"a" + e}><span className="sign mono" style={{ color: "var(--scam)" }} aria-label="Against">−</span><span>{e}</span></div>
              ))}
            </div>
          )}

          {saved.number.notes.length > 0 && (
            <div className="card">
              <div className="label">The number itself</div>
              {saved.number.notes.map((n) => <p className="body" key={n} style={{ fontSize: 14 }}>{n}</p>)}
            </div>
          )}

          {saved.sources.length > 0 && (
            <div className="card">
              <div className="label">Sources · {saved.sources.length}</div>
              {saved.sources.map((s) => (
                <a className="src" key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
              ))}
            </div>
          )}

          <div className="row-btns">
            <button className="btn primary" onClick={() => onMark("safe")} aria-pressed={saved.mark === "safe"}>{saved.mark === "safe" ? "Saved as safe ✓" : "Save as safe"}</button>
            <button className="btn" onClick={() => onMark("scam")} aria-pressed={saved.mark === "scam"}>{saved.mark === "scam" ? "Marked as scam ✓" : "Mark as scam"}</button>
          </div>
          <div className="row-btns">
            <button className="btn" onClick={onAgain}>Check again</button>
            <button className="btn" onClick={share}>{shared ? "Copied" : "Share"}</button>
            <button className="btn" onClick={onRemove}>Remove</button>
          </div>
          {saved.verdict === "scam" && (
            <p className="foot" style={{ marginTop: 0 }}>
              Lost money or gave details? Call your bank on the number on your card, then report it to <a href="https://www.actionfraud.police.uk/" target="_blank" rel="noopener noreferrer">Action Fraud</a>. Scam texts can be forwarded free to 7726.
            </p>
          )}
        </>
      )}
    </main>
  );
}

function Settings({ apiKey, onSave, onBack, onClear, count }: { apiKey: string; onSave: (k: string) => void; onBack: () => void; onClear: () => void; count: number }) {
  const [value, setValue] = useState(apiKey);
  const [status, setStatus] = useState<"" | "checking" | "saved" | string>("");

  const save = async () => {
    const k = value.trim();
    if (!k) {
      onSave("");
      setStatus("Key removed.");
      return;
    }
    setStatus("checking");
    const r = await fetch("/api/key-check", { method: "POST", headers: { "x-gemini-key": k } }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) {
      onSave(k);
      setStatus("saved");
    } else setStatus(data.error || "Couldn't check the key. Try again.");
  };

  return (
    <main className="shell">
      <div className="top">
        <button className="icon-btn" aria-label="Back" onClick={onBack}>{Icon.back}</button>
        <div className="grow kicker mono">SETTINGS</div>
      </div>
      <div className="card">
        <div className="label">Gemini key</div>
        <p className="body">
          Get a free key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>, then paste it here. It&apos;s kept on this device and only sent to Gemini when you check a number.
        </p>
        <div className="field">
          <label htmlFor="key" className="sr">Gemini key</label>
          <input id="key" type="password" autoComplete="off" placeholder="AIza…" value={value} onChange={(e) => { setValue(e.target.value); setStatus(""); }} />
        </div>
        <button className="btn primary" onClick={save} disabled={status === "checking"}>{status === "checking" ? "Checking…" : "Save key"}</button>
        {status && status !== "checking" && (
          <div className="kicker" role="status">{status === "saved" ? "Key works and is saved. You're ready to check numbers." : status}</div>
        )}
      </div>
      <div className="card">
        <div className="label">Your checks</div>
        <p className="body">{count === 1 ? "1 number" : `${count} numbers`} saved on this device.</p>
        <button className="btn" onClick={onClear} disabled={count === 0}>Clear history</button>
      </div>
      <div className="card">
        <div className="label">Install</div>
        <p className="body">Add Caller Check to your home screen from your browser&apos;s menu. On Android you can then share a number from your call log or a text straight to it.</p>
      </div>
    </main>
  );
}
