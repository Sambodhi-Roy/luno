import * as Phaser from "phaser";
import type { Element } from "@/lib/types";
import { themeColor } from "@/lib/theme";
import { WorldScene, type WorldSceneData } from "./scenes/WorldScene";

export type { ConnectionStatus } from "./network/NetworkManager";
export type { WorldSceneData } from "./scenes/WorldScene";

/** What React can do with a running game. */
export type GameController = {
  destroy: () => void;
  setBuildMode: (enabled: boolean) => void;
  setBuildTool: (element: Element | null) => void;
};

// This module is only ever loaded through a dynamic import in GameCanvas, so Phaser never runs on the server
export async function createGame(
  container: HTMLElement,
  data: Omit<WorldSceneData, "onCreated">
): Promise<GameController> {
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
  let buildMode = false;
  let buildTool: Element | null = null;

  // Added (not listed in the config) so the space and callbacks can be passed in as scene data
  game.scene.add("WorldScene", WorldScene, true, {
    ...data,
    onCreated: (created: WorldScene) => {
      scene = created;
      created.setBuildMode(buildMode);
      void created.setBuildTool(buildMode ? buildTool : null);
    },
  });

  return {
    destroy: () => game.destroy(true),
    setBuildMode: (enabled) => {
      buildMode = enabled;
      scene?.setBuildMode(enabled);
    },
    setBuildTool: (element) => {
      buildTool = element;
      if (scene) void scene.setBuildTool(element);
    },
  };
}
