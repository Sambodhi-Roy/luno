import * as Phaser from "phaser";
import { STEP_MS } from "@repo/protocol/rules";
import { bodyFont, cssVar, themeColor } from "@/lib/theme";

export const TILE = 32;
export type Direction = "up" | "down" | "left" | "right";

// Sprite frames are 16x32; drawn at 2x so the character is one tile wide and two tall
const SPRITE_SCALE = 2;
const SPRITE_HEIGHT = 32 * SPRITE_SCALE;
// Names always render above characters and furniture, whose depth is their y position
const LABEL_DEPTH = 1_000_000;
// The "you" marker under the local player's feet
const SELF_MARKER_WIDTH = 26;
const SELF_MARKER_HEIGHT = 10;

/** Animation key for one of a character sheet's animations, e.g. "character:/a.png:walk-down". */
export const animKey = (textureKey: string, name: string) => `${textureKey}:${name}`;

const color = (name: string) => Phaser.Display.Color.HexStringToColor(themeColor(name)).color;

/**
 * A character standing on the tile grid: sprite, walk animations and a name label.
 * Used as-is for other players; LocalPlayer adds keyboard control and the "you" marker.
 */
export class Avatar {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Container;
  private readonly marker: Phaser.GameObjects.Ellipse | null;
  // Label position relative to the sprite, read once since it's used on every animation frame
  private readonly labelOffset = parseFloat(cssVar("--game-label-offset-y"));
  private tween: Phaser.Tweens.Tween | null = null;
  protected direction: Direction = "down";
  tileX: number;
  tileY: number;

  constructor(
    protected readonly scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    name: string,
    // Character sheet texture, loaded by WorldScene along with its animations
    readonly textureKey: string,
    isSelf = false
  ) {
    this.tileX = tileX;
    this.tileY = tileY;

    this.marker = isSelf
      ? scene.add.ellipse(0, 0, SELF_MARKER_WIDTH, SELF_MARKER_HEIGHT, color("primary"), parseFloat(cssVar("--game-self-marker-opacity")))
      : null;
    this.sprite = scene.add.sprite(0, 0, textureKey).setOrigin(0.5, 1).setScale(SPRITE_SCALE);
    this.label = this.createLabel(name, isSelf);

    this.placeAt();
    this.sprite.play(animKey(this.textureKey, `idle-${this.direction}`));
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
    this.sprite.play(animKey(this.textureKey, `walk-${this.direction}`), true);

    const { x, y } = this.worldPosition();
    this.tween = this.scene.tweens.add({
      targets: this.sprite,
      x,
      y,
      duration: STEP_MS,
      onUpdate: () => this.syncAttachments(),
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
    this.marker?.destroy();
  }

  protected face(dx: number, dy: number) {
    if (dx > 0) this.direction = "right";
    else if (dx < 0) this.direction = "left";
    else if (dy > 0) this.direction = "down";
    else if (dy < 0) this.direction = "up";
  }

  protected idle() {
    this.sprite.play(animKey(this.textureKey, `idle-${this.direction}`), true);
  }

  /** Name in a rounded pill; the local player's is purple so you can find yourself at a glance. */
  private createLabel(name: string, isSelf: boolean) {
    const padX = parseFloat(cssVar("--game-label-padding-x"));
    const padY = parseFloat(cssVar("--game-label-padding-y"));
    const text = this.scene.add
      .text(0, 0, name, {
        fontFamily: bodyFont(),
        fontSize: cssVar("--game-label-font-size"),
        fontStyle: "600",
        color: themeColor(isSelf ? "primary-content" : "copy"),
        resolution: window.devicePixelRatio * parseFloat(cssVar("--game-label-supersample")),
      })
      .setOrigin(0.5, 1);

    const width = text.width + padX * 2;
    const height = text.height + padY * 2;
    const pill = this.scene.add.graphics();
    pill.fillStyle(color(isSelf ? "primary" : "background"), isSelf ? 1 : parseFloat(cssVar("--game-label-opacity")));
    pill.fillRoundedRect(-width / 2, -height, width, height, Math.min(parseFloat(cssVar("--game-label-radius")), height / 2));
    text.setY(-padY);

    return this.scene.add.container(0, 0, [pill, text]).setDepth(LABEL_DEPTH);
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
    this.syncAttachments();
  }

  private syncAttachments() {
    const { x, y } = this.sprite;
    // Draw in front of anything whose bottom edge is above the character's feet
    this.sprite.setDepth(y);
    this.label.setPosition(x, y - SPRITE_HEIGHT + this.labelOffset);
    // Just under the feet, and just behind the character
    this.marker?.setPosition(x, y - SELF_MARKER_HEIGHT / 2).setDepth(y - 1);
  }
}
