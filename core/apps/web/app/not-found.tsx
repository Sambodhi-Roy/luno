import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="bg-dots flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center">
      <Logo href="/" />
      <div>
        <p className="heading-display text-8xl text-primary-light">404</p>
        <h1 className="heading-display mt-2 text-3xl">You wandered off the map</h1>
        <p className="mx-auto mt-3 max-w-sm text-copy-lighter">
          There&apos;s nothing at this address. The link may be wrong, or the page may have moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/dashboard" className="btn-primary">
          Go to dashboard
        </Link>
        <Link href="/" className="btn-subtle">
          Home
        </Link>
      </div>
    </main>
  );
}
