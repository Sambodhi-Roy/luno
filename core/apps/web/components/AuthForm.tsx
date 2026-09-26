"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { Button, ErrorText, Input, Label } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Signup also sets the cookie, but signing in keeps both flows on one code path
      if (isSignup) await api("/user/signup", { method: "POST", body: { username, password } });
      await api("/user/signin", { method: "POST", body: { username, password } });
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 card p-8"
      >
        <div>
          <Link href="/" className="text-sm font-semibold text-primary">
            luno
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
        </div>

        <label className="block">
          <Label>Username</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </label>

        <label className="block">
          <Label>Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </label>

        <ErrorText>{error}</ErrorText>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
        </Button>

        <p className="text-center text-sm text-copy-lighter">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link href={isSignup ? "/login" : "/signup"} className="text-primary hover:underline">
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </form>
    </main>
  );
}
