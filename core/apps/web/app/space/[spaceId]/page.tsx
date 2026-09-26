"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { api, ApiError } from "@/lib/api";
import type { SpaceDetail } from "@/lib/types";
import { useMe } from "@/lib/useMe";

export default function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { me } = useMe();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api<SpaceDetail>(`/space/${spaceId}`)
      .then(setSpace)
      .catch((e) =>
        setError(e instanceof ApiError && e.status === 404 ? "This space doesn't exist." : e.message)
      );
  }, [me, spaceId]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      {space && <GameCanvas space={space} />}

      {!space && (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-copy-lighter">
          {error ?? "Loading space…"}
          {error && (
            <Link href="/dashboard" className="text-primary hover:underline">
              Back to dashboard
            </Link>
          )}
        </div>
      )}

      <div className="absolute top-4 left-4 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="btn-ghost bg-foreground px-3"
        >
          ← Back
        </Link>
        {space && (
          <span className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium">
            {space.name}
          </span>
        )}
      </div>
    </main>
  );
}
