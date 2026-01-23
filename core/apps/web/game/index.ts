import * as Phaser from "phaser"
import { WorldScene } from "./scenes/WorldScene";

export async function createGame(container: HTMLElement) {
  const Phaser = await import("phaser");

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    backgroundColor: "#2d2d2d",
    pixelArt: true,
    scene: [WorldScene],
    scale: {
      mode: Phaser.Scale.RESIZE,          
      autoCenter: Phaser.Scale.CENTER_BOTH, 
    },
    physics:{
      default: "arcade",
      arcade:{
        debug: false,
      },
    }
  });

  return game;
}
