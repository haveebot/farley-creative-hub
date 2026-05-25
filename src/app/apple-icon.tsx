import { ImageResponse } from "next/og";
import { getHubPreferences } from "@/lib/db/hub-preferences";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple touch icon. Same logic as /icon — custom URL if set, generated
 * F mark otherwise. iOS adds its own corner rounding, so no border-radius
 * here.
 */
export default async function AppleIcon() {
  try {
    const prefs = await getHubPreferences();
    if (prefs.favicon_url) {
      const res = await fetch(prefs.favicon_url, { cache: "no-store" });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return new Response(buf, {
          headers: {
            "Content-Type": res.headers.get("content-type") ?? "image/png",
            "Cache-Control": "public, max-age=300, must-revalidate",
          },
        });
      }
    }
  } catch {
    // Fall through.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#c97d5d",
          color: "#fafaf7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          fontStyle: "italic",
          fontSize: 150,
          lineHeight: 1,
          letterSpacing: -6,
          paddingBottom: 10,
        }}
      >
        F
      </div>
    ),
    { ...size },
  );
}
