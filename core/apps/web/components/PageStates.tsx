"use client";

import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";
import type { MeStatus } from "@/lib/useMe";
import { Button, FullPageState } from "./ui";

/**
 * What a signed-in page shows before `me` is known: a loading screen, or a retry screen when the API can't be
 * reached. Signed-out visitors are already on their way to /login, so they keep seeing the loading screen.
 */
export function MeFallback({
  status,
  error,
  retry,
  loadingText,
}: {
  status: MeStatus;
  error: string | null;
  retry: () => void;
  loadingText?: string;
}) {
  if (status === "error") {
    return (
      <FullPageState
        icon={WifiOff}
        title="Can't connect"
        actions={
          <Button onClick={retry}>
            <RefreshCw className="size-4" />
            Try again
          </Button>
        }
      >
        {error}
      </FullPageState>
    );
  }
  return <FullPageState>{loadingText}</FullPageState>;
}

/** Link back to the dashboard, used as the action on error screens. */
export function DashboardLink({ variant = "primary" }: { variant?: "primary" | "subtle" }) {
  return (
    <Link href="/dashboard" className={variant === "primary" ? "btn-primary" : "btn-subtle"}>
      Go to dashboard
    </Link>
  );
}
