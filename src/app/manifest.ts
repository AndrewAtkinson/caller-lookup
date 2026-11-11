import type { MetadataRoute } from "next";

/** Installable to the home screen. On Android, sharing a number from the call log or a text opens a check for it. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caller Check",
    short_name: "Caller Check",
    description: "Is that number a scam, a nuisance caller or a genuine business?",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#0d1117",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: { action: "/", method: "GET", params: { title: "title", text: "text", url: "url" } },
  } as MetadataRoute.Manifest;
}
