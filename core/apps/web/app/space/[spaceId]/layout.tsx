import type { Metadata } from "next";

// The page is a client component, so its title is set here
export const metadata: Metadata = { title: "Space" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
