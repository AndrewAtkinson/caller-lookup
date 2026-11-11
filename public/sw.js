// Only here so the site can be installed. It caches nothing, so a new version
// of the site is never held back by an old copy, and every check is live.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
