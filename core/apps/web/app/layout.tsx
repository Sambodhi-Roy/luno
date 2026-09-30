import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

// UI text
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Headings and the wordmark
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Luno: your team's place to hang out",
    template: "%s · Luno",
  },
  description: "A 2D virtual space where your team walks around, bumps into each other and hangs out together.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
