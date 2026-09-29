import * as Phaser from "phaser";
import type { Element } from "@/lib/types";
import { themeColor } from "@/lib/theme";
import { WorldScene, type GameOptions } from "./scenes/WorldScene";

export type { ConnectionStatus } from "./network/NetworkManager";
export type { EditModeData, GameOptions, PlayModeData } from "./scenes/WorldScene";

/** What React can do with a running game. */
export type GameController = {
  destroy: () => void;
  // Edit mode only: the furniture to place, or null for none
  setBuildTool: (element: Element | null) => void;
};

// This module is only ever loaded through a dynamic import in GameCanvas, so Phaser never runs on the server
export async function createGame(container: HTMLElement, options: GameOptions): Promise<GameController> {
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
  });

  // The scene only exists once Phaser has booted and run create(), so remember what React asked for
  // and apply it then
  let scene: WorldScene | null = null;
  let buildTool: Element | null = null;

  // Added (not listed in the config) so the space and callbacks can be passed in as scene data
  game.scene.add("WorldScene", WorldScene, true, {
    ...options,
    onCreated: (created: WorldScene) => {
      scene = created;
      void created.setBuildTool(buildTool);
    },
  });

  return {
    destroy: () => game.destroy(true),
    setBuildTool: (element) => {
      buildTool = element;
      if (scene) void scene.setBuildTool(element);
    },
  };
}
