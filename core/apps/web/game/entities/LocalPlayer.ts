import * as Phaser from "phaser";
import { directionOf, type Direction, type Tile } from "@repo/protocol/rules";
import { Avatar } from "./Avatar";

type Keys = Record<"up" | "down" | "left" | "right" | "up2" | "down2" | "left2" | "right2", Phaser.Input.Keyboard.Key>;

/**
 * The player's own character: WASD / arrow keys step one tile at a time, and clicking the map walks a path there.
 * Steps are predicted locally with the shared collision rules and reported to the server, which can reject them.
 */
export class LocalPlayer extends Avatar {
  private readonly keys: Keys;
  // Click-to-walk: the tiles still to walk, first one next
  private path: Tile[] = [];

  constructor(
    scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    name: string,
    textureKey: string,
    direction: Direction,
    // Asked on every step, so furniture placed or removed later is respected
    private readonly canEnter: (tileX: number, tileY: number) => boolean,
    // A step, or a turn on the spot (same tile, new direction)
    private readonly onMove: (tileX: number, tileY: number, dir: Direction) => void,
    // The path was finished or abandoned
    private readonly onPathEnd: () => void
  ) {
    super(scene, tileX, tileY, name, textureKey, true, direction);

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

  get facing() {
    return this.direction;
  }

  update() {
    if (!this.moving) this.tryStep();
  }

  /** Walks along a path (from findPath), replacing any walk in progress. */
  walkPath(path: Tile[]) {
    this.path = path;
    if (!this.moving) this.tryStep();
  }

  /** Stops following a path (the current step still finishes). */
  stopPath() {
    if (this.path.length === 0) return;
    this.path = [];
    this.onPathEnd();
  }

  override snapTo(tileX: number, tileY: number) {
    // A server correction or respawn makes the rest of a path meaningless
    this.stopPath();
    super.snapTo(tileX, tileY);
  }

  private tryStep() {
    const keyDirection = this.heldDirection();
    // The keyboard always wins over a click
    if (keyDirection) this.stopPath();
    const next = keyDirection
      ? { x: this.tileX + keyDirection[0], y: this.tileY + keyDirection[1] }
      : this.path.shift();
    if (!next) return this.idle();

    const dir = directionOf({ x: this.tileX, y: this.tileY }, next)!;
    if (!this.canEnter(next.x, next.y)) {
      // Blocked (a wall, or furniture placed since the path was planned): turn to face it, like bumping into it
      this.stopPath();
      if (dir !== this.direction) {
        this.turn(dir);
        this.onMove(this.tileX, this.tileY, dir);
      }
      return this.idle();
    }

    this.onMove(next.x, next.y, dir);
    const last = !keyDirection && this.path.length === 0;
    // Chain straight into the next step while a key is held or the path goes on, so walking doesn't stutter
    this.stepTo(next.x, next.y, () => {
      if (last) this.onPathEnd();
      this.tryStep();
    });
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
