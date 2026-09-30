"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { ApiError, api, friendlyError } from "@/lib/api";
import { safeNextPath } from "@/lib/navigation";
import { useMe } from "@/lib/useMe";
import { HeroArt } from "./HeroArt";
import { Logo } from "./Logo";
import { Button, ErrorText, Hint, Input, Label } from "./ui";

const MIN_PASSWORD = 8;

function authError(e: unknown, isSignup: boolean) {
  if (e instanceof ApiError) {
    // Signin answers 400 for a too-short password and 401 for a wrong one; both mean the same to the user
    if (!isSignup && (e.status === 400 || e.status === 401)) return "That username and password don't match.";
    if (isSignup && e.status === 400) return `Pick a username, and a password of at least ${MIN_PASSWORD} characters.`;
    if (isSignup && e.status === 409) return "That username is taken. Try another one.";
  }
  return friendlyError(e);
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  // Set when a signed-out user was sent here from a page, e.g. an invite link
  const next = useSearchParams().get("next");
  const { me } = useMe({ redirectToLogin: false });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordId = useId();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";
  const fromInvite = next?.startsWith("/invite/");

  // Already signed in: skip the form
  useEffect(() => {
    if (me) router.replace(safeNextPath(next));
  }, [me, next, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Signup also sets the cookie, but signing in keeps both flows on one code path
      if (isSignup) await api("/user/signup", { method: "POST", body: { username, password } });
      await api("/user/signin", { method: "POST", body: { username, password } });
      router.replace(safeNextPath(next));
    } catch (e) {
      setError(authError(e, isSignup));
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col p-6 sm:p-10">
        <Logo href="/" />

        <div className="flex flex-1 items-center justify-center py-10">
          <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
            <div>
              <h1 className="heading-display text-3xl">{isSignup ? "Create your account" : "Welcome back"}</h1>
              <p className="mt-2 text-copy-lighter">
                {isSignup ? "It takes ten seconds. No email needed." : "Log in to get back to your spaces."}
              </p>
            </div>

            {fromInvite && (
              <div className="flex gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
                <Mail className="mt-0.5 size-4 shrink-0 text-primary-light" />
                <span>
                  You&apos;ve been invited to a space. {isSignup ? "Create an account" : "Log in"} and we&apos;ll take
                  you straight there.
                </span>
              </div>
            )}

            <label className="block">
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
              />
            </label>

            <div>
              <label htmlFor={passwordId}>
                <Label>Password</Label>
              </label>
              <div className="relative">
                <Input
                  id={passwordId}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={isSignup ? MIN_PASSWORD : undefined}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-copy-lighter hover:text-copy"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {isSignup && <Hint>At least {MIN_PASSWORD} characters.</Hint>}
            </div>

            <ErrorText>{error}</ErrorText>

            <Button type="submit" busy={submitting} className="btn-lg w-full">
              {isSignup ? "Create account" : "Log in"}
            </Button>

            <p className="text-center text-sm text-copy-lighter">
              {isSignup ? "Already have an account? " : "New to Luno? "}
              <Link
                href={`${isSignup ? "/login" : "/signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
                className="link"
              >
                {isSignup ? "Log in" : "Create an account"}
              </Link>
            </p>
          </form>
        </div>
      </div>

      <aside className="bg-dots hidden flex-col justify-center gap-10 border-l border-border bg-foreground p-12 lg:flex">
        <HeroArt compact />
        <div>
          <p className="heading-display text-2xl">Walk up and say hi.</p>
          <p className="mt-2 max-w-md text-copy-lighter">
            Luno is a shared 2D space for your team. Move around, see who&apos;s nearby, and hang out like you&apos;re
            in the same room.
          </p>
        </div>
      </aside>
    </main>
  );
}
