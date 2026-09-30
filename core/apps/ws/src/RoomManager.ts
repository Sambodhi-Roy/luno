import client from "@repo/db/client";
import type { CustomMap, InternalEvent, PlacedElement } from "@repo/protocol";
import { loadTiledMap } from "./assets.js";
import { Room } from "./Room.js";

type SpaceRow = {
  width: number;
  height: number;
  tmjUrl: string | null;
  customMap: CustomMap | null;
  elements: (PlacedElement & { id: string })[];
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

  /**
   * Applies a furniture or custom map change reported by apps/http. Spaces nobody is in are skipped: the next join loads
   * fresh data from the database. A load already in flight may or may not include the change, so wait for it
   * and apply anyway (adds are idempotent by id).
   */
  async applyEvent(spaceId: string, event: InternalEvent) {
    const room = this.rooms.get(spaceId) ?? (await this.loading.get(spaceId));
    if (!room) return;

    if (event.type === "element-added") room.addElement(event.payload);
    else if (event.type === "element-removed") room.removeElement(event.payload.id);
    else room.setCustomMap(event.payload);
  }

  private async load(spaceId: string): Promise<Room | null> {
    // One SQL round trip. The equivalent nested Prisma query issues one query per relation,
    // which made joining take seconds against a remote database.
    const rows = await client.$queryRaw<SpaceRow[]>`
      SELECT s.width, s.height, m."tmjUrl", s."customMap",
        COALESCE(
          json_agg(json_build_object('id', se.id, 'x', se.x, 'y', se.y, 'width', e.width, 'height', e.height, 'static', e.static))
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
    const room = new Room(spaceId, space.width, space.height, tiledMap, space.elements, space.customMap);
    this.rooms.set(spaceId, room);
    return room;
  }
}
