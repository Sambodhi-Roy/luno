import * as Phaser from "phaser";

// The "Doors" object layer of a Tiled map: tile objects (gid, bottom-left origin in pixels), grouped into doors by
// an int property "door". Pipoya has no open-door frames, so a door swings open by narrowing towards its hinge.
type DoorTiledMap = {
  layers: {
    type: string;
    name?: string;
    objects?: { gid?: number; x: number; y: number; properties?: { name: string; value: unknown }[] }[];
  }[];
};

const TILE = 32;
// How narrow an open door gets (the edge left showing at the hinge), how long it takes, and how long it waits
// after everyone has gone before closing
const OPEN_SCALE = 0.15;
const SWING_MS = 180;
const CLOSE_DELAY_MS = 400;

type Door = {
  images: Phaser.GameObjects.Image[];
  // Tiles where someone standing (or next to) opens it: the door's own tiles and the ones in front of it
  triggers: { x: number; y: number }[];
  open: boolean;
  lastNear: number;
};

export class Doors {
  private readonly doors: Door[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    tiled: DoorTiledMap
  ) {
    const layer = tiled.layers.find((l) => l.type === "objectgroup" && l.name === "Doors");
    const groups = new Map<unknown, { gid: number; x: number; y: number }[]>();
    for (const obj of layer?.objects ?? []) {
      if (!obj.gid) continue;
      const id = obj.properties?.find((p) => p.name === "door")?.value ?? obj;
      const tiles = groups.get(id) ?? [];
      tiles.push({ gid: obj.gid, x: Math.round(obj.x / TILE), y: Math.round(obj.y / TILE) - 1 });
      groups.set(id, tiles);
    }

    for (const tiles of groups.values()) {
      const left = Math.min(...tiles.map((t) => t.x));
      const right = Math.max(...tiles.map((t) => t.x));
      const images: Phaser.GameObjects.Image[] = [];
      for (const t of tiles) {
        const frame = this.frameFor(map, t.gid);
        if (!frame) continue;
        // A double door's right half hinges on the right, everything else on the left
        const hingeRight = right > left && t.x === right;
        images.push(
          scene.add
            .image((t.x + (hingeRight ? 1 : 0)) * TILE, t.y * TILE, frame.key, frame.name)
            .setOrigin(hingeRight ? 1 : 0, 0)
        );
      }
      const bottom = Math.max(...tiles.map((t) => t.y));
      const triggers = [...tiles.map(({ x, y }) => ({ x, y })), ...tiles.filter((t) => t.y === bottom).map((t) => ({ x: t.x, y: t.y + 1 }))];
      this.doors.push({ images, triggers, open: false, lastNear: 0 });
    }
  }

  /** Opens doors with someone on or beside them, and closes the rest once they've been left alone a moment. */
  update(people: { tileX: number; tileY: number }[]) {
    const now = this.scene.time.now;
    for (const door of this.doors) {
      const near = people.some((p) => door.triggers.some((t) => Math.abs(t.x - p.tileX) <= 1 && Math.abs(t.y - p.tileY) <= 1));
      if (near) door.lastNear = now;
      const open = near || (door.open && now - door.lastNear < CLOSE_DELAY_MS);
      if (open === door.open) continue;
      door.open = open;
      this.scene.tweens.killTweensOf(door.images);
      this.scene.tweens.add({
        targets: door.images,
        scaleX: open ? OPEN_SCALE : 1,
        alpha: open ? 0.85 : 1,
        duration: SWING_MS,
        ease: open ? "Sine.easeOut" : "Sine.easeIn",
      });
    }
  }

  // A texture frame for one tile of a tileset image (tileset textures are keyed by tileset name)
  private frameFor(map: Phaser.Tilemaps.Tilemap, gid: number) {
    const tileset = map.tilesets.find((ts) => gid >= ts.firstgid && gid < ts.firstgid + ts.total);
    if (!tileset) return null;
    const coords = tileset.getTileTextureCoordinates(gid) as { x: number; y: number } | null;
    const texture = this.scene.textures.get(tileset.name);
    if (!coords || !texture) return null;
    const name = `door:${gid}`;
    if (!texture.has(name)) texture.add(name, 0, coords.x, coords.y, tileset.tileWidth, tileset.tileHeight);
    return { key: tileset.name, name };
  }
}
