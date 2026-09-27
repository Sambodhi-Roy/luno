// Movement rules shared by the server (which enforces them) and the client (which predicts them),
// so both always agree on which tiles can be entered. No dependencies, so the browser can import
// this file on its own via "@repo/protocol/rules".

/** Time for one tile step. The client animates at this pace; the server rejects faster movement. */
export const STEP_MS = 180;

/** Minimal slice of a Tiled .tmj map that collision needs. */
export type TiledMap = {
  width: number;
  height: number;
  layers: { type: string; data?: number[] }[];
  tilesets: {
    firstgid: number;
    tiles?: { id: number; properties?: { name: string; value: unknown }[] }[];
  }[];
};

/** A placed element: top-left tile plus its footprint in tiles. */
export type PlacedElement = {
  x: number;
  y: number;
  width: number;
  height: number;
  static: boolean;
};

// Tiled stores flip/rotation flags in the top bits of each gid
const GID_MASK = 0x1fffffff;

export class CollisionGrid {
  private readonly blocked: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number
  ) {
    this.blocked = new Uint8Array(width * height);
  }

  inBounds(x: number, y: number) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  block(x: number, y: number) {
    if (this.inBounds(x, y)) this.blocked[y * this.width + x] = 1;
  }

  isWalkable(x: number, y: number) {
    return this.inBounds(x, y) && this.blocked[y * this.width + x] === 0;
  }
}

/**
 * Builds the grid for a space: tiles whose Tiled tile has `collides: true`, plus the bottom row of
 * every static element (so tall furniture can be walked behind in top-down view).
 */
export function buildCollisionGrid(
  width: number,
  height: number,
  map: TiledMap | null,
  elements: PlacedElement[]
): CollisionGrid {
  const grid = new CollisionGrid(width, height);

  if (map) {
    const collides = new Set<number>();
    for (const tileset of map.tilesets) {
      for (const tile of tileset.tiles ?? []) {
        if (tile.properties?.some((p) => p.name === "collides" && p.value === true)) {
          collides.add(tileset.firstgid + tile.id);
        }
      }
    }

    for (const layer of map.layers) {
      if (layer.type !== "tilelayer" || !layer.data) continue;
      layer.data.forEach((gid, i) => {
        if (collides.has(gid & GID_MASK)) grid.block(i % map.width, Math.floor(i / map.width));
      });
    }
  }

  for (const el of elements) {
    if (!el.static) continue;
    const bottom = el.y + el.height - 1;
    for (let x = el.x; x < el.x + el.width; x++) grid.block(x, bottom);
  }

  return grid;
}

/** A legal step moves exactly one tile up, down, left or right. */
export function isSingleStep(from: { x: number; y: number }, to: { x: number; y: number }) {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y) === 1;
}
