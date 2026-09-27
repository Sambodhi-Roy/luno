import * as Phaser from "phaser";
import type { CollisionGrid } from "@repo/protocol/rules";
import { Avatar } from "./Avatar";

type Keys = Record<"up" | "down" | "left" | "right" | "up2" | "down2" | "left2" | "right2", Phaser.Input.Keyboard.Key>;

/**
 * The player's own character: WASD / arrow keys step one tile at a time.
 * Steps are predicted locally with the shared collision grid and reported to the server, which can reject them.
 */
export class LocalPlayer extends Avatar {
  private readonly keys: Keys;

  constructor(
    scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    name: string,
    private readonly grid: CollisionGrid,
    private readonly onStep: (tileX: number, tileY: number) => void
  ) {
    super(scene, tileX, tileY, name);

    const { KeyCodes } = Phaser.Input.Keyboard;
    this.keys = scene.input.keyboard!.addKeys({
      up: KeyCodes.W,
      down: KeyCodes.S,
      left: KeyCodes.A,
      right: KeyCodes.D,
      up2: KeyCodes.UP,
      down2: KeyCodes.DOWN,
      left2: KeyCodes.LEFT,
      right2: KeyCodes.RIGHT,
    }) as Keys;
  }

  update() {
    if (!this.moving) this.tryStep();
  }

  private tryStep() {
    const direction = this.heldDirection();
    if (!direction) return this.idle();

    const [dx, dy] = direction;
    const x = this.tileX + dx;
    const y = this.tileY + dy;

    if (!this.grid.isWalkable(x, y)) {
      // Blocked: turn to face it, like bumping into a wall
      this.face(dx, dy);
      return this.idle();
    }

    this.onStep(x, y);
    // Chain straight into the next step while a key is held, so walking doesn't stutter
    this.stepTo(x, y, () => this.tryStep());
  }

  // One axis at a time: movement is strictly up/down/left/right on the grid
  private heldDirection(): [number, number] | null {
    const k = this.keys;
    if (k.left.isDown || k.left2.isDown) return [-1, 0];
    if (k.right.isDown || k.right2.isDown) return [1, 0];
    if (k.up.isDown || k.up2.isDown) return [0, -1];
    if (k.down.isDown || k.down2.isDown) return [0, 1];
    return null;
  }
}
