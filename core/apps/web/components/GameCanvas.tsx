"use client";

import { useEffect, useRef } from "react";
import type { ConnectionStatus } from "@/game";
import type { Me, SpaceDetail } from "@/lib/types";

type GameCanvasProps = {
  space: SpaceDetail;
  me: Me;
  // Pass stable functions (e.g. state setters): a new function recreates the game
  onStatus: (status: ConnectionStatus) => void;
  onPresence: (online: number) => void;
};

export function GameCanvas({ space, me, onStatus, onPresence }: GameCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // createGame resolves asynchronously, so cleanup can run before the game exists
    // (e.g. React StrictMode's double mount). The flag makes a late game destroy itself.
    let cancelled = false;
    let game: { destroy: (removeCanvas: boolean) => void } | undefined;

    (async () => {
      const mod = await import("../game/index");
      const created = await mod.createGame(ref.current!, { space, me, onStatus, onPresence });
      if (cancelled) created.destroy(true);
      else game = created;
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [space, me, onStatus, onPresence]);

  return <div ref={ref} className="flex h-full w-full" />;
}
