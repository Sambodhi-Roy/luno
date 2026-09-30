"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Armchair, Footprints, Link2, MousePointerClick, Shirt, Users, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { HeroArt } from "@/components/HeroArt";
import { Logo } from "@/components/Logo";
import { FullPageState } from "@/components/ui";
import { useMe } from "@/lib/useMe";

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Footprints,
    title: "Walk up and talk",
    text: "Move around a shared map with your keyboard and see everyone else moving in real time.",
  },
  {
    icon: Armchair,
    title: "Make it yours",
    text: "Drop in desks, sofas and plants. Changes show up for everyone inside, instantly.",
  },
  {
    icon: Link2,
    title: "Invite your team",
    text: "Keep a space private and share an invite link, or make it public for anyone to drop by.",
  },
];

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Shirt, title: "Pick a character", text: "Choose how you look to everyone else." },
  { icon: MousePointerClick, title: "Create a space", text: "Start from a map and arrange the furniture." },
  { icon: Users, title: "Bring people in", text: "Send the link. Walk over and say hi." },
];

export default function Home() {
  const router = useRouter();
  const { me, loading } = useMe({ redirectToLogin: false });

  useEffect(() => {
    if (me) router.replace("/dashboard");
  }, [me, router]);

  // Signed-in visitors go straight to the dashboard; don't flash the marketing page at them
  if (loading || me) return <FullPageState />;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" />
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost border-transparent">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-dots">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="badge-primary">
                <span className="relative flex size-2">
                  <span className="status-dot-ping bg-primary-light" />
                  <span className="status-dot bg-primary-light" />
                </span>
                Your team, in one place
              </span>
              <h1 className="heading-display mt-5 text-5xl leading-none sm:text-6xl">
                The office you <span className="text-primary-light">actually</span> want to hang out in.
              </h1>
              <p className="mt-6 max-w-lg text-lg text-copy-light">
                Luno is a 2D space where your team walks around, bumps into each other and hangs out, just like being in
                the same room.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="btn-primary btn-lg">
                  Create your space
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="/login" className="btn-subtle btn-lg">
                  I have an account
                </Link>
              </div>
            </div>
            <HeroArt />
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className="eyebrow">Why Luno</p>
            <h2 className="heading-display mt-2 max-w-xl text-3xl sm:text-4xl">Less like a video call. More like a place.</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="card p-6 transition-colors hover:border-border-strong">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-copy-lighter">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border bg-foreground">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className="eyebrow">How it works</p>
            <h2 className="heading-display mt-2 text-3xl sm:text-4xl">Up and running in a minute</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="flex gap-4">
                  <span className="heading-display flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong text-copy-light">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                      <Icon className="size-4 text-primary-light" />
                      {title}
                    </h3>
                    <p className="mt-1 text-sm text-copy-lighter">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="brand-glow flex flex-col items-center rounded-3xl bg-primary px-6 py-14 text-center text-primary-content">
              <h2 className="heading-display text-3xl sm:text-4xl">Your team&apos;s new hangout is waiting.</h2>
              <p className="mt-3 max-w-md opacity-90">Free to try. Make a space and send the link to your team.</p>
              <Link href="/signup" className="btn btn-lg mt-8 bg-primary-content text-primary-darker hover:bg-copy-light">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-copy-lighter sm:flex-row sm:px-6">
          <Logo />
          <p>A 2D space to hang out and work together.</p>
        </div>
      </footer>
    </div>
  );
}
