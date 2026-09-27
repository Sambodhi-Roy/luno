"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { SpaceElement } from "@repo/protocol";
import { BuildPalette } from "@/components/BuildPalette";
import { GameCanvas } from "@/components/GameCanvas";
import type { ConnectionStatus, GameController } from "@/game";
import { api, ApiError } from "@/lib/api";
import type { Element, SpaceDetail } from "@/lib/types";
import { useMe } from "@/lib/useMe";

// How long a build-mode error stays on screen
const NOTICE_MS = 3000;

export default function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { me } = useMe();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({ state: "connecting" });
  const [online, setOnline] = useState(0);
  const [game, setGame] = useState<GameController | null>(null);
  const [building, setBuilding] = useState(false);
  const [catalogue, setCatalogue] = useState<Element[] | null>(null);
  const [tool, setTool] = useState<Element | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isOwner = !!space && !!me && space.creatorId === me.id;

  useEffect(() => {
    if (!me) return;
    api<SpaceDetail>(`/space/${spaceId}`)
      .then(setSpace)
      .catch((e) =>
        setError(e instanceof ApiError && e.status === 404 ? "This space doesn't exist." : e.message)
      );
  }, [me, spaceId]);

  // Keep the game in step with the build UI
  useEffect(() => {
    game?.setBuildMode(building);
  }, [game, building]);

  useEffect(() => {
    game?.setBuildTool(building ? tool : null);
  }, [game, building, tool]);

  // The furniture catalogue is only needed once build mode opens
  useEffect(() => {
    if (!building || catalogue) return;
    api<{ elements: Element[] }>("/space/elements")
      .then((res) => setCatalogue(res.elements))
      .catch((e) => setNotice(e.message));
  }, [building, catalogue]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTool(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Saved through the API; the WebSocket server then pushes the change to everyone else in the space
  const onPlace = useCallback(
    async (elementId: string, x: number, y: number) => {
      try {
        const res = await api<{ element: SpaceElement }>("/space/element", {
          method: "POST",
          body: { spaceId, elementId, x, y },
        });
        return res.element;
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Could not place that here");
        return null;
      }
    },
    [spaceId]
  );

  const onRemove = useCallback(async (id: string) => {
    try {
      await api("/space/element", { method: "DELETE", body: { id } });
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not remove that");
      return false;
    }
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      {space && me && (
        <GameCanvas
          space={space}
          me={me}
          onStatus={setStatus}
          onPresence={setOnline}
          onPlace={onPlace}
          onRemove={onRemove}
          onReady={setGame}
        />
      )}

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
          <button
            onClick={() => setBuilding((b) => !b)}
            className={building ? "btn-primary px-3" : "btn-ghost bg-foreground px-3"}
            aria-pressed={building}
          >
            {building ? "Done building" : "Build"}
          </button>
        )}
      </div>

      {building && (
        <div className="absolute top-4 right-4 bottom-4 flex">
          <BuildPalette elements={catalogue} selectedId={tool?.id ?? null} onSelect={setTool} />
        </div>
      )}

      {notice && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <span className="chip text-error">
            <span className="status-dot bg-error" />
            {notice}
          </span>
        </div>
      )}
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
