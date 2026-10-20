// Movement rules shared by the server (which enforces them) and the client (which predicts them),
// so both always agree on which tiles can be entered. No dependencies, so the browser can import
// this file on its own via "@repo/protocol/rules".

/** Time for one tile step. The client animates at this pace; the server rejects faster movement. */
export const STEP_MS = 180;

/** Which way a character faces. */
export type Direction = "up" | "down" | "left" | "right";
export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

/** A tile coordinate. */
export type Tile = { x: number; y: number };

/** Minimal slice of a Tiled .tmj map that collision and spawning need. */
export type TiledMap = {
  width: number;
  height: number;
  tilewidth?: number;
  tileheight?: number;
  layers: {
    type: string;
    name?: string;
    data?: number[];
    // Object layers: positions and sizes in pixels
    objects?: { x: number; y: number; width?: number; height?: number }[];
  }[];
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
 * Builds the grid for a space: tiles whose Tiled tile has `collides: true` (or, for a custom map, void floor,
 * walls and wall faces), plus the bottom row of every static element (so tall furniture can be walked behind
 * in top-down view).
 */
export function buildCollisionGrid(
  width: number,
  height: number,
  map: TiledMap | null,
  elements: PlacedElement[],
  // A space built in the editor has this instead of a Tiled map
  customMap: CustomMap | null = null
): CollisionGrid {
  const grid = new CollisionGrid(width, height);

  if (customMap) {
    for (const i of customMapBlocked(customMap, width, height)) grid.block(i % width, Math.floor(i / width));
  }

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
export function isSingleStep(from: Tile, to: Tile) {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y) === 1;
}

/** The direction of a single step (or the dominant axis of a longer one), or null for no movement. */
export function directionOf(from: Tile, to: Tile): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

// Click-to-walk never searches more tiles than this (a 60x60 map has 3600)
const MAX_PATH_SEARCH = 20_000;

/**
 * The shortest walk (4-way, one tile per step) from `from` to `to`, not including `from`. When `to` can't be
 * reached (a wall, furniture, or a closed-off room) it walks to the reachable tile closest to it instead.
 * Returns an empty path when there's nowhere better to go.
 */
export function findPath(grid: CollisionGrid, from: Tile, to: Tile): Tile[] {
  const { width } = grid;
  if (!grid.inBounds(from.x, from.y)) return [];
  const start = from.y * width + from.x;
  const cameFrom = new Map<number, number>([[start, -1]]);
  const queue = [start];
  const distanceToTarget = (i: number) => Math.abs((i % width) - to.x) + Math.abs(Math.floor(i / width) - to.y);
  let best = start;
  let bestDistance = distanceToTarget(start);

  for (let head = 0; head < queue.length && head < MAX_PATH_SEARCH; head++) {
    const i = queue[head]!;
    const d = distanceToTarget(i);
    // Breadth-first, so the first tile seen at a given distance is also the closest to walk to
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
      if (d === 0) break;
    }
    const x = i % width;
    const y = Math.floor(i / width);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const n = ny * width + nx;
      if (!grid.isWalkable(nx, ny) || cameFrom.has(n)) continue;
      cameFrom.set(n, i);
      queue.push(n);
    }
  }

  const path: Tile[] = [];
  for (let i = best; i !== start; i = cameFrom.get(i)!) path.push({ x: i % width, y: Math.floor(i / width) });
  return path.reverse();
}

/**
 * Spawn tiles marked in a Tiled map: every tile covered by an object in an object layer named "Spawn" (a point
 * marks one tile, a rectangle every tile it covers).
 */
export function tiledSpawnTiles(map: TiledMap): Tile[] {
  const tw = map.tilewidth ?? 32;
  const th = map.tileheight ?? 32;
  const tiles: Tile[] = [];
  for (const layer of map.layers) {
    if (layer.type !== "objectgroup" || layer.name?.toLowerCase() !== "spawn") continue;
    for (const o of layer.objects ?? []) {
      const x0 = Math.floor(o.x / tw);
      const y0 = Math.floor(o.y / th);
      const x1 = o.width ? Math.ceil((o.x + o.width) / tw) - 1 : x0;
      const y1 = o.height ? Math.ceil((o.y + o.height) / th) - 1 : y0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push({ x, y });
    }
  }
  return tiles;
}

/* ---------- Custom maps (built in the editor instead of uploaded from Tiled) ---------- */

/**
 * A custom map's layout: one style id per tile, row by row (index = y * width + x). Ids index the builder
 * palette in the assets (maps/builder/builder.json); this package only needs to know which are empty.
 */
export type CustomMap = {
  // 0 = no floor (void, can't be walked on); n = floor style n
  floor: number[];
  // 0 = no wall; n = wall style n
  walls: number[];
  // Where people appear when they enter (the middle of the map when unset)
  spawn?: Tile | null | undefined;
};

/** Sizes offered when creating a custom map, in tiles (each falls in the web app's matching size label). */
export const CUSTOM_MAP_SIZES = {
  small: { width: 20, height: 15 },
  medium: { width: 32, height: 24 },
  large: { width: 48, height: 36 },
} as const;
export type CustomMapSize = keyof typeof CUSTOM_MAP_SIZES;

/** Highest style id accepted for a floor or wall. */
export const MAX_CUSTOM_STYLE = 63;

/** A new custom map: the first floor style everywhere, and the first wall style around the edge. */
export function newCustomMap(width: number, height: number): CustomMap {
  const floor = new Array<number>(width * height).fill(1);
  const walls = new Array<number>(width * height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) walls[y * width + x] = 1;
    }
  }
  return { floor, walls };
}

/** One tile of a wall's front face. A face is 2 tiles tall and sits below any wall with no wall south of it. */
export type WallFace = {
  x: number;
  y: number;
  // The wall's style, which picks the face's look
  style: number;
  part: "upper" | "lower";
  // Where the tile sits along a run of face, for the art's end pieces
  edge: "left" | "middle" | "right";
};

/**
 * The faces drawn in front of a custom map's walls. The end of a one-tile-wide vertical wall gets no face,
 * so a doorway next to it stays open. A face never covers another wall.
 */
export function wallFaces(map: CustomMap, width: number, height: number): WallFace[] {
  const isWall = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && (map.walls[y * width + x] ?? 0) > 0;
  const uppers = new Map<number, number>(); // tile index -> style
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      if (!isWall(x, y) || isWall(x, y + 1)) continue;
      const loneEnd = !isWall(x - 1, y) && !isWall(x + 1, y) && isWall(x, y - 1);
      if (!loneEnd) uppers.set((y + 1) * width + x, map.walls[y * width + x]!);
    }
  }

  const faces: WallFace[] = [];
  for (const [i, style] of uppers) {
    const x = i % width;
    const y = Math.floor(i / width);
    const left = !uppers.has(i - 1) || x === 0;
    const right = !uppers.has(i + 1) || x === width - 1;
    const edge = left ? "left" : right ? "right" : "middle";
    faces.push({ x, y, style, part: "upper", edge });
    if (y + 1 < height && !isWall(x, y + 1)) faces.push({ x, y: y + 1, style, part: "lower", edge });
  }
  return faces;
}

/** Tiles of a custom map nobody can stand on: no floor, a wall, or a wall's face. */
export function customMapBlocked(map: CustomMap, width: number, height: number) {
  const blocked = new Set<number>();
  for (let i = 0; i < width * height; i++) {
    if (!map.floor[i] || map.walls[i]) blocked.add(i);
  }
  for (const f of wallFaces(map, width, height)) blocked.add(f.y * width + f.x);
  return blocked;
}
