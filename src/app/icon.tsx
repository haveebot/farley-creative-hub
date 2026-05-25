import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Favicon — confident serif "F." on the studio accent.
 *
 * v2 design notes (placeholder for Collie's real mark):
 * - Rounded corners read as "intentionally designed" vs default OS square
 * - Flat accent #c97d5d (gradient was invisible at 32px)
 * - Period as a tiny studio-mark flourish — gives the F a hook and
 *   visually anchors it so it doesn't look lonely in the square
 * - Heavier weight + larger letter so it fills the square confidently
 * - Slight italic tilt for character without losing serif clarity
 */
export default function Icon() {
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
          letterSpacing: -2,
          borderRadius: 7,
          paddingBottom: 2,
        }}
      >
        F.
      </div>
    ),
    { ...size },
  );
}
