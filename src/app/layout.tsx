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
  let accent: string | null = null;
  let theme: string = "light";
  try {
    const prefs = await getHubPreferences();
    accent = prefs.accent_color;
    theme = prefs.theme;
  } catch {
    // ignore — fall back to defaults from globals.css
  }

  return (
    <html lang="en" className={theme === "dark" ? "dark" : ""}>
      {accent && (
        <head>
          <style>{`:root { --accent: ${accent}; } .dark { --accent: ${accent}; }`}</style>
        </head>
      )}
      <body>{children}</body>
    </html>
  );
}
