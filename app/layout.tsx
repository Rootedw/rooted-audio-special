import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./refinements.css";
import "./edition.css";

export const metadata: Metadata = {
  title: "ROOTED AUDIO SPECIAL · by Rooted Within",
  description: "GO BLUEPRINT en het Journaling Workbook van Rooted Within.",
  manifest: "/manifest.webmanifest?v=emblem",
  icons: {
    icon: { url: "/special-home-icon.png", type: "image/png", sizes: "180x180" },
    shortcut: "/special-home-icon.png",
    apple: { url: "/special-home-icon.png", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: { capable: true, title: "ROOTED AUDIO SPECIAL", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#06150f", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
