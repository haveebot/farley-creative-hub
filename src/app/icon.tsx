import { ImageResponse } from "next/og";
import { getHubPreferences } from "@/lib/db/hub-preferences";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Favicon. If hub_preferences.favicon_url is set, serves that image
 * (operator-uploaded custom mark). Otherwise falls back to the
 * generated italic F. on the studio accent.
 *
 * Operator can drop their own favicon in /settings (file upload) or
 * via MCP update_hub_preferences with favicon_url.
 */
export default async function Icon() {
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
    // Fall through to generated mark on any error.
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
          fontSize: 28,
          lineHeight: 1,
          letterSpacing: -1,
          borderRadius: 7,
          paddingBottom: 2,
        }}
      >
        F
      </div>
    ),
    { ...size },
  );
}
