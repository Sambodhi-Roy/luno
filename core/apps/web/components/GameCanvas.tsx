"use client";

import { useEffect, useRef } from "react";
import type { GameController, GameOptions } from "@/game";

type GameCanvasProps = {
  options: GameOptions;
  // Receives the controller once the game exists, and null when it's torn down
  onReady: (controller: GameController | null) => void;
};

// `options` must keep its identity between renders (useMemo over stable callbacks), and onReady must be
// stable: a new value recreates the game
export function GameCanvas({ options, onReady }: GameCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // createGame resolves asynchronously, so cleanup can run before the game exists
    // (e.g. React StrictMode's double mount). The flag makes a late game destroy itself.
    let cancelled = false;
    let game: GameController | undefined;

    (async () => {
      const mod = await import("../game/index");
      const created = await mod.createGame(ref.current!, options);
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
  }, [options, onReady]);

  return <div ref={ref} className="flex h-full w-full" />;
}
