import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-only "N" badge defaults to bottom left, where the space page's chat panel sits
  devIndicators: { position: "bottom-right" },
  // The app lives in the core/ pnpm workspace; pin the root so Next never guesses from stray lockfiles
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
