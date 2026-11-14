import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./refinements.css";

export const metadata: Metadata = {
  title: "ROOTED AUDIO SPECIAL · by Rooted Within",
  description: "GO BLUEPRINT en het Journaling Workbook van Rooted Within.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/rooted-within-icon-192.png?v=20261011-2",
    apple: "/apple-touch-icon.png?v=20261011-3",
  },
  appleWebApp: { capable: true, title: "ROOTED AUDIO SPECIAL", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#06150f", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
