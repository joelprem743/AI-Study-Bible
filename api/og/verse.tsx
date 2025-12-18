/** @jsxImportSource @vercel/og */

import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge",
};

const BACKGROUNDS = [
  "/verse-bg/forest-1.jpg",
  "/verse-bg/forest-2.jpg",
  "/verse-bg/sky-1.jpg",
  "/verse-bg/mountain-1.jpg",
];

export default function handler(req: Request) {
  const { searchParams } = new URL(req.url);

  const ref = searchParams.get("ref") ?? "";
  const text = searchParams.get("text") ?? "";

  const bg =
    BACKGROUNDS[
      Math.abs(
        ref.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
      ) % BACKGROUNDS.length
    ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          padding: "80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          color: "white",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 36, opacity: 0.9 }}>{ref}</div>

        <div
          style={{
            fontSize: 48,
            lineHeight: 1.3,
            textAlign: "center",
            fontWeight: 500,
          }}
        >
          {text}
        </div>

        <div style={{ fontSize: 24, opacity: 0.8 }}>
          AI Study Bible
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );
}
x