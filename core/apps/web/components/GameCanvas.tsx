"use client";

import { useEffect, useRef } from "react";
import type { GameController, WorldSceneData } from "@/game";

type GameCanvasProps = Omit<WorldSceneData, "space" | "me" | "onCreated"> & {
  space: WorldSceneData["space"];
  me: WorldSceneData["me"];
  // Receives the controller once the game exists, and null when it's torn down
  onReady: (controller: GameController | null) => void;
};

// All callbacks must be stable (state setters or useCallback): a new function recreates the game
export function GameCanvas({ space, me, onStatus, onPresence, onPlace, onRemove, onReady }: GameCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // createGame resolves asynchronously, so cleanup can run before the game exists
    // (e.g. React StrictMode's double mount). The flag makes a late game destroy itself.
    let cancelled = false;
    let game: GameController | undefined;

    (async () => {
      const mod = await import("../game/index");
      const created = await mod.createGame(ref.current!, { space, me, onStatus, onPresence, onPlace, onRemove });
      if (cancelled) {
        created.destroy();
        return;
      }
      game = created;
      onReady(created);
    })();

    return () => {
      cancelled = true;
      game?.destroy();
      onReady(null);
    };
  }, [space, me, onStatus, onPresence, onPlace, onRemove, onReady]);

  return <div ref={ref} className="flex h-full w-full" />;
}
