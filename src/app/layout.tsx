import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import "./globals.css";

// Bundled (from @fontsource, OFL) so builds don't depend on reaching Google Fonts.
const inter = localFont({
  variable: "--font-inter",
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700" },
  ],
});
const mono = localFont({
  variable: "--font-mono",
  src: [
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/jetbrains-mono-latin-700-normal.woff2", weight: "700" },
  ],
});

export const metadata: Metadata = {
  title: "Caller Check",
  description: "Look up a UK phone number and see whether it's a scam, a nuisance caller or a genuine business, with the evidence and sources.",
  appleWebApp: { capable: true, title: "Caller Check", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0d1117", width: "device-width", initialScale: 1, viewportFit: "cover" };

// While a new version rolls out, a page from one version can ask for scripts the
// other doesn't have. Reload once to pick up a matching set.
const RELOAD_ON_STALE_SCRIPTS = `(function(){var k="cc-stale-reload";function again(){try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1")}catch(e){return}location.reload()}
addEventListener("error",function(e){var t=e.target;if((t&&t.tagName==="SCRIPT"&&/\\/_next\\/static\\//.test(t.src))||/ChunkLoadError|Loading chunk/.test(e.message||""))again()},true);
addEventListener("unhandledrejection",function(e){var r=e.reason;if(r&&/ChunkLoadError|Loading chunk/.test(r.name+" "+r.message))again()});
addEventListener("load",function(){setTimeout(function(){try{sessionStorage.removeItem(k)}catch(e){}},10000)})})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <head>
        <script dangerouslySetInnerHTML={{ __html: RELOAD_ON_STALE_SCRIPTS }} />
      </head>
      <body className={`${inter.variable} ${mono.variable}`}>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
