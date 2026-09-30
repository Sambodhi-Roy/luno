import * as Phaser from "phaser";
import { wallFaces, type CustomMap } from "@repo/protocol/rules";
import { BUILDER_FOLDER, type Builder, type PaintTool } from "@/lib/builder";
import { TILE } from "./entities/Avatar";

// The custom map editor's art: two tilesets plus builder.json, which says which tile each style id draws
const BUILDER_KEY = "builder:json";
const textureKey = (tileset: string) => `builder:${tileset}`;

/** Queues builder.json, then its tileset images, on a scene's loader. */
export function loadBuilder(load: Phaser.Loader.LoaderPlugin) {
  load.json(BUILDER_KEY, `${BUILDER_FOLDER}builder.json`);
  load.once(`filecomplete-json-${BUILDER_KEY}`, (_key: string, _type: string, builder: Builder) => {
    for (const [name, ts] of Object.entries(builder.tilesets)) {
      load.image(textureKey(name), `${BUILDER_FOLDER}${ts.image}`);
    }
  });
}

// Neighbour bits for the wall-top lookup, in builder.json's order
const NEIGHBOURS: [number, number, number][] = [
  [0, -1, 1],
  [1, -1, 2],
  [1, 0, 4],
  [1, 1, 8],
  [0, 1, 16],
  [-1, 1, 32],
  [-1, 0, 64],
  [-1, -1, 128],
];
const EDGE_INDEX = { left: 0, middle: 1, right: 2 } as const;

/**
 * Draws a custom map (floors, then walls with their autotiled tops and 2-tile faces) and applies brush strokes.
 * Collision comes from the same arrays through buildCollisionGrid, so what you see is what blocks.
 */
export class CustomMapView {
  private readonly builder: Builder;
  private readonly floorLayer: Phaser.Tilemaps.TilemapLayer;
  private readonly wallLayer: Phaser.Tilemaps.TilemapLayer;
  private readonly wallupFirstGid: number;
  private map: CustomMap;

  constructor(
    scene: Phaser.Scene,
    private readonly width: number,
    private readonly height: number,
    map: CustomMap
  ) {
    this.builder = scene.cache.json.get(BUILDER_KEY) as Builder;
    this.map = { floor: [...map.floor], walls: [...map.walls] };

    const { basechip, wallup } = this.builder.tilesets;
    const tilemap = scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width, height });
    this.wallupFirstGid = 1 + basechip.count;
    const tilesets = [
      tilemap.addTilesetImage("basechip", textureKey("basechip"), TILE, TILE, basechip.margin, basechip.spacing, 1)!,
      tilemap.addTilesetImage("wallup", textureKey("wallup"), TILE, TILE, wallup.margin, wallup.spacing, this.wallupFirstGid)!,
    ];
    this.floorLayer = tilemap.createBlankLayer("floor", tilesets)!;
    this.wallLayer = tilemap.createBlankLayer("walls", tilesets)!;
    this.redraw();
  }

  /** A copy of the current layout, e.g. to save it. */
  get current(): CustomMap {
    return { floor: [...this.map.floor], walls: [...this.map.walls] };
  }

  /** The layers, bottom first, e.g. to draw them into a thumbnail. */
  get layers() {
    return [this.floorLayer, this.wallLayer];
  }

  /** Replaces the whole layout (someone saved it from the editor). */
  setMap(map: CustomMap) {
    this.map = { floor: [...map.floor], walls: [...map.walls] };
    this.redraw();
  }

  /** Applies the brush to one tile; returns whether anything changed. Erasing removes a wall, then the floor. */
  paint(x: number, y: number, tool: PaintTool) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const i = y * this.width + x;
    const { floor, walls } = this.map;
    let changed = false;
    if (tool.kind === "floor" && floor[i] !== tool.style) {
      floor[i] = tool.style;
      changed = true;
    } else if (tool.kind === "wall" && walls[i] !== tool.style) {
      walls[i] = tool.style;
      // A wall stands on floor, so the room still looks finished if it's removed later
      if (!floor[i]) floor[i] = 1;
      changed = true;
    } else if (tool.kind === "erase") {
      if (walls[i]) walls[i] = 0;
      else if (floor[i]) floor[i] = 0;
      else return false;
      changed = true;
    }
    if (changed) this.redraw();
    return changed;
  }

  /**
   * How many tiles a wall painted at (x, y) would take up, from its top down: the top, plus the front below it
   * where there's room (the rule in wallFaces). Just the top when the wall joins one below it, or when it ends a
   * one-tile-wide wall coming down from above.
   */
  wallFootprint(x: number, y: number) {
    const isWall = (cx: number, cy: number) =>
      cx >= 0 && cy >= 0 && cx < this.width && cy < this.height && (this.map.walls[cy * this.width + cx] ?? 0) > 0;
    if (isWall(x, y + 1)) return 1;
    if (isWall(x, y - 1) && !isWall(x - 1, y) && !isWall(x + 1, y)) return 1;
    let tiles = 1;
    for (let dy = 1; dy <= 2 && y + dy < this.height && !isWall(x, y + dy); dy++) tiles++;
    return tiles;
  }

  /** Paints every tile with one floor style (walls stay). */
  fillFloor(style: number) {
    if (this.map.floor.every((f) => f === style)) return false;
    this.map.floor.fill(style);
    this.redraw();
    return true;
  }

  private redraw() {
    const { width, height, builder, map } = this;
    const isWall = (x: number, y: number) =>
      x < 0 || y < 0 || x >= width || y >= height || (map.walls[y * width + x] ?? 0) > 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const floor = builder.floors[(map.floor[i] ?? 0) - 1];
        if (floor) this.floorLayer.putTileAt(1 + floor.tile, x, y);
        else this.floorLayer.removeTileAt(x, y);

        if ((map.walls[i] ?? 0) > 0) {
          let mask = 0;
          for (const [dx, dy, bit] of NEIGHBOURS) if (isWall(x + dx, y + dy)) mask |= bit;
          this.wallLayer.putTileAt(this.wallupFirstGid + (builder.wallTop[mask] ?? 0), x, y);
        } else {
          this.wallLayer.removeTileAt(x, y);
        }
      }
    }

    for (const face of wallFaces(map, width, height)) {
      const style = builder.walls[face.style - 1] ?? builder.walls[0];
      if (!style) continue;
      this.wallLayer.putTileAt(1 + style[face.part][EDGE_INDEX[face.edge]], face.x, face.y);
    }
  }
}
