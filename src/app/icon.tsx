import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Favicon — italic serif "F" on the studio accent color.
 * Placeholder until Collie ships a proper mark. Uses the same accent
 * (#c97d5d) the rest of the Hub keys off, so it sits next to the
 * tenant identity instead of looking like a default.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #c97d5d 0%, #a85a3d 100%)",
          color: "#fafaf7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          fontStyle: "italic",
          fontSize: 26,
          letterSpacing: -1,
          // Slight optical offset so the italic F feels balanced
          paddingRight: 2,
        }}
      >
        F
      </div>
    ),
    { ...size },
  );
}
