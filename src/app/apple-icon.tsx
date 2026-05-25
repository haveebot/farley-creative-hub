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
          alignItems: "baseline",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          fontSize: 150,
          letterSpacing: -6,
          paddingTop: 20,
        }}
      >
        <span style={{ fontStyle: "italic", display: "flex" }}>F</span>
        <span
          style={{
            display: "flex",
            fontStyle: "normal",
            fontWeight: 900,
            color: "#fafaf7",
            opacity: 0.9,
            marginLeft: 4,
          }}
        >
          .
        </span>
      </div>
    ),
    { ...size },
  );
}
