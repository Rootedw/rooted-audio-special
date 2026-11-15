import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./refinements.css";
import "./edition.css";

export const metadata: Metadata = {
  title: "ROOTED AUDIO SPECIAL · by Rooted Within",
  description: "GO BLUEPRINT en het Journaling Workbook van Rooted Within.",
  manifest: "/manifest.webmanifest?v=20261115",
  icons: {
    icon: { url: "/rooted-within-icon-192.png?v=20261115", type: "image/png", sizes: "192x192" },
    shortcut: "/rooted-within-icon-192.png?v=20261115",
    apple: "/apple-touch-icon.png?v=20261115",
  },
  appleWebApp: { capable: true, title: "ROOTED AUDIO SPECIAL", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#06150f", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
