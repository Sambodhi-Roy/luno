import * as Phaser from "phaser";
import { STEP_MS } from "@repo/protocol/rules";
import { bodyFont, cssVar, themeColor } from "@/lib/theme";

export const TILE = 32;
export type Direction = "up" | "down" | "left" | "right";

const SPRITE_KEY = "adam";
// Sprite frames are 16x32; drawn at 2x so the character is one tile wide and two tall
const SPRITE_SCALE = 2;
const SPRITE_HEIGHT = 32 * SPRITE_SCALE;
// Names always render above characters and furniture, whose depth is their y position
const LABEL_DEPTH = 1_000_000;

/**
 * A character standing on the tile grid: sprite, walk animations and a name label.
 * Used as-is for other players; LocalPlayer adds keyboard control.
 */
export class Avatar {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;
  protected direction: Direction = "down";
  tileX: number;
  tileY: number;

  constructor(
    protected readonly scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    name: string
  ) {
    this.tileX = tileX;
    this.tileY = tileY;

    this.sprite = scene.add.sprite(0, 0, SPRITE_KEY).setOrigin(0.5, 1).setScale(SPRITE_SCALE);
    this.label = scene.add
      .text(0, 0, name, {
        fontFamily: bodyFont(),
        fontSize: cssVar("--game-label-font-size"),
        color: themeColor("copy"),
        backgroundColor: themeColor("foreground"),
        padding: {
          x: parseFloat(cssVar("--game-label-padding-x")),
          y: parseFloat(cssVar("--game-label-padding-y")),
        },
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5, 1)
      .setDepth(LABEL_DEPTH);

    this.placeAt();
    this.sprite.play(`idle-${this.direction}`);
  }

  get moving() {
    return this.tween !== null;
  }

  /** Animates one step to an adjacent tile. A step already in progress is finished instantly first. */
  stepTo(tileX: number, tileY: number, onComplete?: () => void) {
    this.finishStep();
    this.face(tileX - this.tileX, tileY - this.tileY);
    this.tileX = tileX;
    this.tileY = tileY;
    this.sprite.play(`walk-${this.direction}`, true);

    const { x, y } = this.worldPosition();
    this.tween = this.scene.tweens.add({
      targets: this.sprite,
      x,
      y,
      duration: STEP_MS,
      onUpdate: () => this.syncLabel(),
      onComplete: () => {
        this.tween = null;
        if (onComplete) onComplete();
        else this.idle();
      },
    });
  }

  /** Jumps straight to a tile (spawn, server correction, missed updates). */
  snapTo(tileX: number, tileY: number) {
    this.tween?.remove();
    this.tween = null;
    this.tileX = tileX;
    this.tileY = tileY;
    this.placeAt();
    this.idle();
  }

  /** Moves to a tile reported by the server: animated when adjacent, snapped otherwise. */
  moveTo(tileX: number, tileY: number) {
    const distance = Math.abs(tileX - this.tileX) + Math.abs(tileY - this.tileY);
    if (distance === 1) this.stepTo(tileX, tileY);
    else if (distance > 1) this.snapTo(tileX, tileY);
  }

  destroy() {
    this.tween?.remove();
    this.sprite.destroy();
    this.label.destroy();
  }

  protected face(dx: number, dy: number) {
    if (dx > 0) this.direction = "right";
    else if (dx < 0) this.direction = "left";
    else if (dy > 0) this.direction = "down";
    else if (dy < 0) this.direction = "up";
  }

  protected idle() {
    this.sprite.play(`idle-${this.direction}`, true);
  }

  private finishStep() {
    if (!this.tween) return;
    this.tween.remove();
    this.tween = null;
    this.placeAt();
  }

  private worldPosition() {
    // Feet at the bottom-centre of the tile
    return { x: this.tileX * TILE + TILE / 2, y: (this.tileY + 1) * TILE };
  }

  private placeAt() {
    const { x, y } = this.worldPosition();
    this.sprite.setPosition(x, y);
    this.syncLabel();
  }

  private syncLabel() {
    // Draw in front of anything whose bottom edge is above the character's feet
    this.sprite.setDepth(this.sprite.y);
    this.label.setPosition(this.sprite.x, this.sprite.y - SPRITE_HEIGHT);
  }
}
