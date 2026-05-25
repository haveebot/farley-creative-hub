import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple touch icon (iOS home-screen) — same mark as the favicon
 * but rendered at 180px. iOS adds its own corner rounding so we
 * skip border-radius here; the F. mark is what carries the design.
 */
export default function AppleIcon() {
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
          letterSpacing: -10,
          paddingBottom: 10,
        }}
      >
        F.
      </div>
    ),
    { ...size },
  );
}
