import client from "@repo/db/client";
import { buildCollisionGrid, type PlacedElement } from "@repo/protocol";
import { loadTiledMap } from "./assets.js";
import { Room } from "./Room.js";

type SpaceRow = {
  width: number;
  height: number;
  tmjUrl: string | null;
  elements: PlacedElement[];
};

/** Loads a space into memory on first join and drops it when the last person leaves. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  // Concurrent joins to a space that isn't loaded yet share one load
  private readonly loading = new Map<string, Promise<Room | null>>();

  /** Returns the live room for a space, or null if the space doesn't exist. */
  async get(spaceId: string): Promise<Room | null> {
    const existing = this.rooms.get(spaceId);
    if (existing) return existing;

    let pending = this.loading.get(spaceId);
    if (!pending) {
      pending = this.load(spaceId).finally(() => this.loading.delete(spaceId));
      this.loading.set(spaceId, pending);
    }
    return pending;
  }

  /** True while this exact room object is the one registered for its space. */
  isLive(room: Room) {
    return this.rooms.get(room.spaceId) === room;
  }

  releaseIfEmpty(room: Room) {
    if (room.isEmpty && this.isLive(room)) this.rooms.delete(room.spaceId);
  }

  private async load(spaceId: string): Promise<Room | null> {
    // One SQL round trip. The equivalent nested Prisma query issues one query per relation,
    // which made joining take seconds against a remote database.
    const rows = await client.$queryRaw<SpaceRow[]>`
      SELECT s.width, s.height, m."tmjUrl",
        COALESCE(
          json_agg(json_build_object('x', se.x, 'y', se.y, 'width', e.width, 'height', e.height, 'static', e.static))
            FILTER (WHERE se.id IS NOT NULL),
          '[]'
        ) AS elements
      FROM "Space" s
      LEFT JOIN "Map" m ON m.id = s."mapId"
      LEFT JOIN "spaceElements" se ON se."spaceId" = s.id
      LEFT JOIN "Element" e ON e.id = se."elementId"
      WHERE s.id = ${spaceId}
      GROUP BY s.id, m."tmjUrl"`;

    const space = rows[0];
    if (!space) return null;

    const tiledMap = space.tmjUrl ? await loadTiledMap(space.tmjUrl) : null;
    const grid = buildCollisionGrid(space.width, space.height, tiledMap, space.elements);

    const room = new Room(spaceId, grid);
    this.rooms.set(spaceId, room);
    return room;
  }
}
