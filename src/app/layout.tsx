import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Farley Creative Hub",
  description: "Operator-tier dashboard for Farley Girls Creative.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
