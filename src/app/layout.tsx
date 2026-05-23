import type { Metadata } from "next";
import { getBrand } from "@/lib/db/brand";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const brand = await getBrand();
    return {
      title: brand.hub_label,
      description: `Operator dashboard for ${brand.studio_name}.`,
    };
  } catch {
    // Brand not available (e.g. DB unreachable during build) — fall back.
    return {
      title: "Farley Creative Hub",
      description: "Operator-tier dashboard for Farley Girls Creative.",
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Load brand for CSS variable injection. Any failure (DB unavailable
  // during build) falls back to the default token already set in globals.css.
  let accent: string | null = null;
  try {
    const brand = await getBrand();
    accent = brand.primary_color;
  } catch {
    // ignore; CSS default applies
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
