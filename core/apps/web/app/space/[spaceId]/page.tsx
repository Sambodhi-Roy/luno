"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import type { ConnectionStatus, GameController, GameOptions } from "@/game";
import { api, ApiError } from "@/lib/api";
import type { SpaceDetail } from "@/lib/types";
import { useMe } from "@/lib/useMe";

// The game controller only matters in the editor; here the game runs on its own
const ignoreController: (controller: GameController | null) => void = () => {};

function loadError(e: unknown) {
  if (e instanceof ApiError && e.status === 404) return "This space doesn't exist.";
  if (e instanceof ApiError && e.status === 403) return "This space is private. Ask its owner for an invite link.";
  return e instanceof Error ? e.message : "Could not load this space";
}

export default function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { me } = useMe();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({ state: "connecting" });
  const [online, setOnline] = useState(0);

  const isOwner = !!space && !!me && space.creatorId === me.id;

  useEffect(() => {
    if (!me) return;
    api<SpaceDetail>(`/space/${spaceId}`)
      .then((loaded) => {
        setSpace(loaded);
        // Puts the space on the visitor's dashboard (under Joined). Nothing to show if it fails.
        api(`/space/${spaceId}/visit`, { method: "POST" }).catch(() => {});
      })
      .catch((e) => setError(loadError(e)));
  }, [me, spaceId]);

  const options = useMemo<GameOptions | null>(
    () => (space && me ? { mode: "play", space, me, onStatus: setStatus, onPresence: setOnline } : null),
    [space, me]
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      {options && <GameCanvas options={options} onReady={ignoreController} />}

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
        <Link href="/dashboard" className="btn-ghost bg-foreground px-3">
          ← Back
        </Link>
        {space && (
          <>
            <span className="chip">{space.name}</span>
            <StatusChip status={status} online={online} />
          </>
        )}
        {isOwner && (
          <Link href={`/space/${spaceId}/edit`} className="btn-ghost bg-foreground px-3">
            Edit
          </Link>
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
