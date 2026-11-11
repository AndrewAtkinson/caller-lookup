import { cookies } from "next/headers";
import { after } from "next/server";

// Counts a key action (like "invoice_sent") in PostHog against the visitor who
// did it, so it shows under "What people did" in Client Pulse. Sent after the
// response, so it never slows anything down or breaks it.
const APP = "caller-lookup";

export async function track(event: string, properties: Record<string, unknown> = {}) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || process.env.NODE_ENV !== "production") return;
  let person: string | null = null;
  try {
    const raw = (await cookies()).get(`ph_${key}_posthog`)?.value;
    if (raw) person = JSON.parse(decodeURIComponent(raw))?.distinct_id ?? null;
  } catch {
    // No cookie, or not in a request: count it without a person.
  }
  after(async () => {
    try {
      await fetch("https://eu.i.posthog.com/i/v0/e/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event,
          distinct_id: person ?? `server-${APP}`,
          properties: { app: APP, side: "server", $process_person_profile: Boolean(person), ...properties },
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Analytics must never cause an error of its own.
    }
  });
}
