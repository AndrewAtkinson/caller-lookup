// Usage and error tracking (PostHog, EU). Every app sends to the same PostHog
// project and tags its events with `app`, so they can be seen together or apart.
const APP = "caller-lookup";
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key && process.env.NODE_ENV === "production") {
  // Loaded after the page is up, so it never slows the first screen.
  setTimeout(() => {
    void Promise.all([import("posthog-js"), import("./lib/feedback")]).then(([{ default: posthog }, { startFeedback }]) => {
      posthog.init(key, {
        api_host: "https://eu.i.posthog.com",
        defaults: "2025-05-24",
        person_profiles: "always",
        capture_exceptions: true,
        capture_performance: { web_vitals: true },
        capture_dead_clicks: true,
      });
      posthog.register({
        app: APP,
        installed: window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
      });
      startFeedback(posthog, "Caller Check");
    });
  }, 2000);
}
