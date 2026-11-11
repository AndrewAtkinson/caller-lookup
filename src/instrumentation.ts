import type { Instrumentation } from "next";

// Sends server-side crashes (pages, API routes, server actions) to PostHog's
// error tracking, next to the browser errors, tagged with this app's name.
const APP = "caller-lookup";
const HOST = "https://eu.i.posthog.com";

function visitorId(cookieHeader: string | undefined, key: string) {
  // posthog-js keeps the visitor's id in a cookie, so a server error can be
  // tied to the person who hit it.
  const name = `ph_${key}_posthog=`;
  const raw = cookieHeader?.split(/;\s*/).find((c) => c.startsWith(name))?.slice(name.length);
  if (!raw) return null;
  try {
    const id = JSON.parse(decodeURIComponent(raw))?.distinct_id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || process.env.NODE_ENV !== "production") return;
  const error = err instanceof Error ? (err as Error & { digest?: string }) : new Error(String(err));
  const cookie = request.headers.cookie;
  const person = visitorId(Array.isArray(cookie) ? cookie.join("; ") : cookie, key);
  try {
    await fetch(`${HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: "$exception",
        distinct_id: person ?? `server-${APP}`,
        properties: {
          app: APP,
          side: "server",
          $process_person_profile: Boolean(person),
          $exception_list: [
            {
              type: error.name || "Error",
              value: error.message,
              mechanism: { handled: false, synthetic: false, type: "onRequestError" },
            },
          ],
          stack: error.stack?.slice(0, 4000),
          digest: (error as { digest?: string }).digest,
          path: request.path,
          method: request.method,
          route: context.routePath,
          route_type: context.routeType,
          router: context.routerKind,
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Never let reporting an error cause another one.
  }
};
