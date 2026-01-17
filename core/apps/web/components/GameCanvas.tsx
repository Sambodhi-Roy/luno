"use client";

import { useEffect, useRef } from "react";

export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    let game: any;

    (async () => {
      const mod = await import("../game/index");
      game = await mod.createGame(ref.current!);
    })();

    return () => {
      if (game) game.destroy(true);
    };
  }, []);

  return <div ref={ref} className="w-full h-full flex" />;
}
