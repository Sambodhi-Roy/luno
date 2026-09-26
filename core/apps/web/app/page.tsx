"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/lib/useMe";

export default function Home() {
  const router = useRouter();
  const { me, loading } = useMe({ redirectToLogin: false });

  useEffect(() => {
    if (me) router.replace("/dashboard");
  }, [me, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <p className="text-sm font-semibold tracking-widest text-primary uppercase">luno</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Your team&apos;s place to hang out</h1>
        <p className="mx-auto mt-4 max-w-md text-copy-lighter">
          Walk around a shared 2D space, bump into people, and talk to whoever is nearby.
        </p>
      </div>
      <div className={`flex gap-3 ${loading || me ? "invisible" : ""}`}>
        <Link
          href="/signup"
          className="btn-primary"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="btn-ghost"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
