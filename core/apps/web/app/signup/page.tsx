import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign up" };

// AuthForm reads ?next= from the URL, which needs a Suspense boundary on a statically rendered page
export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
