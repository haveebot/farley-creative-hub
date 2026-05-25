import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple touch icon (iOS home-screen). Same mark as the favicon but
 * rendered at 180x180 so it stays crisp when iOS rounds the corners
 * and renders it on the home screen.
 */
export default function AppleIcon() {
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
          fontSize: 140,
          letterSpacing: -6,
          paddingRight: 10,
        }}
      >
        F
      </div>
    ),
    { ...size },
  );
}
