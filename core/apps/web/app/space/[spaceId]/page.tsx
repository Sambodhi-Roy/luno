"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import type { ConnectionStatus } from "@/game";
import { api, ApiError } from "@/lib/api";
import type { SpaceDetail } from "@/lib/types";
import { useMe } from "@/lib/useMe";

export default function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { me } = useMe();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({ state: "connecting" });
  const [online, setOnline] = useState(0);

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
      {space && me && <GameCanvas space={space} me={me} onStatus={setStatus} onPresence={setOnline} />}

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
          <>
            <span className="chip">{space.name}</span>
            <StatusChip status={status} online={online} />
          </>
        )}
      </div>
    </main>
  );
}

function StatusChip({ status, online }: { status: ConnectionStatus; online: number }) {
  if (status.state === "connected") {
    return (
      <span className="chip">
        <span className="status-dot bg-success" />
        {online} online
      </span>
    );
  }
  if (status.state === "closed") {
    return (
      <span className="chip text-error">
        <span className="status-dot bg-error" />
        {status.reason}
      </span>
    );
  }
  return (
    <span className="chip text-copy-lighter">
      <span className="status-dot bg-warning" />
      {status.state === "connecting" ? "Connecting…" : "Reconnecting…"}
    </span>
  );
}
