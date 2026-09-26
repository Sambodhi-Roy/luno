import * as Phaser from "phaser";
import { themeColor } from "@/lib/theme";
import type { SpaceDetail } from "@/lib/types";
import { WorldScene } from "./scenes/WorldScene";

// This module is only ever loaded through a dynamic import in GameCanvas, so Phaser never runs on the server
export async function createGame(container: HTMLElement, space: SpaceDetail) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    backgroundColor: themeColor("background"),
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: "100%",
      height: "100%",
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
  });

  // Added (not listed in the config) so the space can be passed in as scene data
  game.scene.add("WorldScene", WorldScene, true, { space });

  return game;
}
