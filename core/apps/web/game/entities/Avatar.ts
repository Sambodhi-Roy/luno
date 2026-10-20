import * as Phaser from "phaser";
import { directionOf, STEP_MS, type Direction } from "@repo/protocol/rules";
import { bodyFont, cssVar, themeColor } from "@/lib/theme";

export const TILE = 32;
export type { Direction };

// Sprite frames are 32x32, drawn at 1x: one tile, at the same pixel density as the map
const SPRITE_SCALE = 1;
const SPRITE_HEIGHT = 32 * SPRITE_SCALE;
// Names always render above characters and furniture, whose depth is their y position
const LABEL_DEPTH = 1_000_000;
// The "you" marker under the local player's feet
const SELF_MARKER_WIDTH = 26;
const SELF_MARKER_HEIGHT = 10;
// Another player's steps that arrive while one is still animating wait their turn; past this many the avatar
// has fallen behind (a busy tab, a lag spike) and jumps to the latest tile instead
const MAX_QUEUED_STEPS = 3;
// With steps waiting, each plays a little faster so the avatar catches up
const CATCH_UP_STEP_FACTOR = 0.75;

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
  // Other players only: steps reported by the server that haven't been animated yet, and the way to face once
  // they're done
  private readonly queue: { x: number; y: number }[] = [];
  private finalDirection: Direction | null = null;
  protected direction: Direction;
  tileX: number;
  tileY: number;
  // Character sheet texture, loaded by WorldScene along with its animations
  textureKey: string;

  constructor(
    protected readonly scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    readonly name: string,
    textureKey: string,
    isSelf = false,
    direction: Direction = "down"
  ) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.textureKey = textureKey;
    this.direction = direction;

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
  stepTo(tileX: number, tileY: number, onComplete?: () => void, duration = STEP_MS) {
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
      duration,
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
    this.queue.length = 0;
    this.tileX = tileX;
    this.tileY = tileY;
    this.placeAt();
    this.idle();
  }

  /**
   * Another player moved or turned (as reported by the server). Steps play one after another, so they glide
   * even when updates arrive in bursts; anything that isn't a single step from where they're heading snaps.
   */
  moveTo(tileX: number, tileY: number, dir: Direction) {
    const last = this.queue.at(-1) ?? { x: this.tileX, y: this.tileY };
    const distance = Math.abs(tileX - last.x) + Math.abs(tileY - last.y);

    if (distance === 0) {
      // A turn on the spot: now, or once the steps still playing are done
      if (this.moving || this.queue.length > 0) {
        this.finalDirection = dir;
      } else {
        this.direction = dir;
        this.idle();
      }
      return;
    }

    this.finalDirection = dir;
    if (distance > 1 || this.queue.length >= MAX_QUEUED_STEPS) {
      this.snapTo(tileX, tileY);
      this.applyFinalDirection();
      return;
    }
    this.queue.push({ x: tileX, y: tileY });
    if (!this.moving) this.playQueue();
  }

  /** Swaps the character sheet (the player picked another avatar). */
  setTexture(textureKey: string) {
    if (textureKey === this.textureKey) return;
    this.textureKey = textureKey;
    const walking = this.moving;
    this.sprite.setTexture(textureKey);
    this.sprite.play(animKey(textureKey, `${walking ? "walk" : "idle"}-${this.direction}`));
  }

  /** Turns to face a direction without moving. */
  turn(dir: Direction) {
    this.direction = dir;
    if (!this.moving) this.idle();
  }

  destroy() {
    this.tween?.remove();
    this.sprite.destroy();
    this.label.destroy();
    this.marker?.destroy();
  }

  protected face(dx: number, dy: number) {
    this.direction = directionOf({ x: 0, y: 0 }, { x: dx, y: dy }) ?? this.direction;
  }

  private playQueue() {
    const next = this.queue.shift();
    if (!next) return this.applyFinalDirection();
    const duration = this.queue.length > 0 ? STEP_MS * CATCH_UP_STEP_FACTOR : STEP_MS;
    this.stepTo(next.x, next.y, () => this.playQueue(), duration);
  }

  private applyFinalDirection() {
    if (this.finalDirection) this.direction = this.finalDirection;
    this.finalDirection = null;
    this.idle();
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
