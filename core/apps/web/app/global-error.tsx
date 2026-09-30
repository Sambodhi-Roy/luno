"use client";

import { Inter, Space_Grotesk } from "next/font/google";
import ErrorPage from "./error";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

// Replaces the root layout when it fails, so it brings its own <html>, fonts and styles
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        <ErrorPage {...props} />
      </body>
    </html>
  );
}
