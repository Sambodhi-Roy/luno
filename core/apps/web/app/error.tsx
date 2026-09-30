"use client";

import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, FullPageState } from "@/components/ui";

// Shown when a page throws while rendering
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <FullPageState
      icon={TriangleAlert}
      title="Something went wrong"
      actions={
        <>
          <Button onClick={reset}>
            <RefreshCw className="size-4" />
            Try again
          </Button>
          <Link href="/dashboard" className="btn-subtle">
            Go to dashboard
          </Link>
        </>
      }
    >
      This page hit an unexpected problem. Trying again usually fixes it.
    </FullPageState>
  );
}
