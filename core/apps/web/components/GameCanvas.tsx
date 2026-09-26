"use client";

import { useEffect, useRef } from "react";
import type { SpaceDetail } from "@/lib/types";

export function GameCanvas({ space }: { space: SpaceDetail }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // createGame resolves asynchronously, so cleanup can run before the game exists
    // (e.g. React StrictMode's double mount). The flag makes a late game destroy itself.
    let cancelled = false;
    let game: { destroy: (removeCanvas: boolean) => void } | undefined;

    (async () => {
      const mod = await import("../game/index");
      const created = await mod.createGame(ref.current!, space);
      if (cancelled) created.destroy(true);
      else game = created;
    })();

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [space]);

  return <div ref={ref} className="flex h-full w-full" />;
}
