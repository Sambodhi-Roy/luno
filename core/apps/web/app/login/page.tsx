import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Log in" };

// AuthForm reads ?next= from the URL, which needs a Suspense boundary on a statically rendered page
export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
