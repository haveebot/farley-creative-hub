import type { Metadata } from "next";
import { getHubPreferences } from "@/lib/db/hub-preferences";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const prefs = await getHubPreferences();
    return {
      title: prefs.hub_label,
      description: `Operator dashboard.`,
    };
  } catch {
    return {
      title: "Farley Creative Hub",
      description: "Operator-tier dashboard.",
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Inject Hub accent color as a CSS variable. Falls back to globals.css
  // default if DB is unavailable (e.g. during build).
  let accent: string | null = null;
  try {
    const prefs = await getHubPreferences();
    accent = prefs.accent_color;
  } catch {
    // ignore
  }

  return (
    <html lang="en">
      {accent && (
        <head>
          <style>{`:root { --accent: ${accent}; }`}</style>
        </head>
      )}
      <body>{children}</body>
    </html>
  );
}
