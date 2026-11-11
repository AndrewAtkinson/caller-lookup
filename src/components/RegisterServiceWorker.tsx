"use client";
import { useEffect } from "react";

/** Phones only offer "Install" for sites with a service worker. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
