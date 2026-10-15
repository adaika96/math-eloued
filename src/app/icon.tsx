import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #10b981 0%, #059669 45%, #064e3b 100%)",
          borderRadius: "44px",
          border: "4px solid #f59e0b",
          color: "white",
        }}
      >
        <div
          style={{
            fontSize: 98,
            fontWeight: 900,
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textShadow: "0 4px 12px rgba(0,0,0,0.35)",
          }}
        >
          ∑
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: "#a7f3d0",
            letterSpacing: 1,
            marginTop: 2,
          }}
        >
          MATH
        </div>
      </div>
    ),
    { ...size }
  );
}
