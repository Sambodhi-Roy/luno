import * as Phaser from "phaser";
import type { Element } from "@/lib/types";
import { themeColor } from "@/lib/theme";
import { TILE } from "../entities/Avatar";

// The preview is see-through so what's underneath stays visible
const GHOST_ALPHA = 0.6;
const OUTLINE_WIDTH = 2;
// Above furniture and characters, below name labels
const GHOST_DEPTH = 900_000;

/**
 * Build-mode placement preview: a see-through copy of the selected element that follows the pointer,
 * snapped to the tile grid, with an outline showing whether it fits inside the space.
 */
export class BuildTool {
  private ghost: Phaser.GameObjects.Image | null = null;
  private readonly outline: Phaser.GameObjects.Rectangle;
  private element: Element | null = null;
  private tileX = 0;
  private tileY = 0;
  private readonly okColor = Phaser.Display.Color.HexStringToColor(themeColor("primary")).color;
  private readonly badColor = Phaser.Display.Color.HexStringToColor(themeColor("error")).color;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly spaceWidth: number,
    private readonly spaceHeight: number,
    private readonly textureKey: (element: Element) => string
  ) {
    this.outline = scene.add
      .rectangle(0, 0, TILE, TILE)
      .setOrigin(0, 0)
      .setFillStyle()
      .setDepth(GHOST_DEPTH)
      .setVisible(false);
  }

  get selected() {
    return this.element;
  }

  /** The tile the preview's top-left corner is on, and whether the element fits there. */
  get target() {
    const el = this.element;
    const fits =
      !!el &&
      this.tileX >= 0 &&
      this.tileY >= 0 &&
      this.tileX + el.width <= this.spaceWidth &&
      this.tileY + el.height <= this.spaceHeight;
    return { x: this.tileX, y: this.tileY, fits };
  }

  /** Shows the preview for an element whose texture is already loaded, or hides it with null. */
  select(element: Element | null) {
    this.element = element;
    this.ghost?.destroy();
    this.ghost = null;
    this.outline.setVisible(!!element);
    if (!element) return;

    this.ghost = this.scene.add
      .image(0, 0, this.textureKey(element))
      .setOrigin(0, 0)
      .setDisplaySize(element.width * TILE, element.height * TILE)
      .setAlpha(GHOST_ALPHA)
      .setDepth(GHOST_DEPTH);
    this.outline.setSize(element.width * TILE, element.height * TILE);
    this.update();
  }

  /** Follows the pointer; called every frame because the camera moves even when the mouse doesn't. */
  update() {
    if (!this.element || !this.ghost) return;
    const pointer = this.scene.input.activePointer;
    const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    this.tileX = Math.floor(world.x / TILE);
    this.tileY = Math.floor(world.y / TILE);

    const px = this.tileX * TILE;
    const py = this.tileY * TILE;
    this.ghost.setPosition(px, py);
    this.outline.setPosition(px, py).setStrokeStyle(OUTLINE_WIDTH, this.target.fits ? this.okColor : this.badColor);
  }

  destroy() {
    this.ghost?.destroy();
    this.outline.destroy();
  }
}
