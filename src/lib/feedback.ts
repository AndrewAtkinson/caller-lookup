import type { PostHog } from "posthog-js";

// A small "How's it going?" box with thumbs up/down and an optional comment.
// It shows once, on someone's second day using the app (then not again for
// 60 days), after they've been on the page a little while. Answers go to
// PostHog as a "feedback" event and show up in Client Pulse.

const SEEN_DAYS = "ph_fb_days";
const LAST_ASKED = "ph_fb_asked";
const ASK_EVERY_MS = 60 * 86_400_000;

export function startFeedback(posthog: PostHog, appName: string) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const days: string[] = JSON.parse(localStorage.getItem(SEEN_DAYS) || "[]");
    if (!days.includes(today)) localStorage.setItem(SEEN_DAYS, JSON.stringify([...days, today].slice(-5)));
    const asked = Number(localStorage.getItem(LAST_ASKED) || 0);
    if (days.filter((d) => d !== today).length < 1 || Date.now() - asked < ASK_EVERY_MS) return;
    setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      localStorage.setItem(LAST_ASKED, String(Date.now()));
      show(posthog, appName);
    }, 40_000);
  } catch {
    // Storage blocked (private browsing): just don't ask.
  }
}

function show(posthog: PostHog, appName: string) {
  const host = document.createElement("div");
  host.setAttribute("data-feedback-box", "");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .box { position: fixed; z-index: 2147483000; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); width: min(320px, calc(100vw - 32px));
        box-sizing: border-box; padding: 14px 16px; border-radius: 14px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #fff; color: #1a1a1a; border: 1px solid rgba(0,0,0,.12); box-shadow: 0 8px 30px rgba(0,0,0,.18); }
      /* Phones: sit above any bottom tab bar. */
      @media (max-width: 640px) { .box { bottom: calc(84px + env(safe-area-inset-bottom)); } }
      @media (prefers-color-scheme: dark) { .box { background: #1d1f24; color: #f2f2f2; border-color: rgba(255,255,255,.14); } }
      .row { display: flex; align-items: center; gap: 8px; }
      .q { flex: 1; font-weight: 600; }
      button { font: inherit; color: inherit; cursor: pointer; border: 1px solid rgba(127,127,127,.35); background: transparent; border-radius: 10px; min-width: 44px; min-height: 44px; }
      .x { border: 0; min-width: 32px; min-height: 32px; opacity: .6; font-size: 18px; }
      .thumb { font-size: 20px; }
      textarea { display: block; width: 100%; box-sizing: border-box; margin: 10px 0 8px; min-height: 70px; padding: 8px; border-radius: 10px; font: inherit;
        color: inherit; background: transparent; border: 1px solid rgba(127,127,127,.35); resize: vertical; }
      .send { width: 100%; font-weight: 600; }
      .hide { display: none; }
    </style>
    <div class="box" role="dialog" aria-label="Feedback">
      <div class="row">
        <span class="q"></span>
        <button class="thumb" data-r="up" aria-label="Good">👍</button>
        <button class="thumb" data-r="down" aria-label="Not good">👎</button>
        <button class="x" aria-label="Close">×</button>
      </div>
      <form class="more hide">
        <textarea maxlength="500" aria-label="Your comment"></textarea>
        <button class="send" type="submit">Send</button>
      </form>
    </div>`;
  const q = root.querySelector(".q") as HTMLElement;
  q.textContent = `How's ${appName} working for you?`;
  const form = root.querySelector(".more") as HTMLFormElement;
  const text = root.querySelector("textarea") as HTMLTextAreaElement;
  let rating = "";
  const close = () => host.remove();
  root.querySelector(".x")?.addEventListener("click", () => {
    if (rating) posthog.capture("feedback", { rating });
    close();
  });
  root.querySelectorAll<HTMLButtonElement>(".thumb").forEach((b) =>
    b.addEventListener("click", () => {
      rating = b.dataset.r || "up";
      root.querySelectorAll<HTMLButtonElement>(".thumb").forEach((t) => t.classList.add("hide"));
      q.textContent = rating === "up" ? "Great! Anything you'd add? (optional)" : "Sorry about that. What went wrong? (optional)";
      form.classList.remove("hide");
      text.focus();
    }),
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    posthog.capture("feedback", { rating, comment: text.value.trim().slice(0, 500) });
    form.classList.add("hide");
    q.textContent = "Thanks, that really helps.";
    setTimeout(close, 1800);
  });
  document.body.appendChild(host);
}
