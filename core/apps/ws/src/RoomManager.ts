import client, { CHAT_RETENTION_DAYS } from "@repo/db/client";
import type { ChatEntry, CustomMap, Direction, InternalEvent, InternalUserEvent, PlacedElement, Tile } from "@repo/protocol";
import { loadTiledMap } from "./assets.js";
import { RECENT_CHAT, Room } from "./Room.js";
import { CLOSE_FORBIDDEN, CLOSE_NOT_FOUND } from "./Session.js";

// Someone who comes back to a space within this long (a reload, a dropped connection) reappears where they left
const RESUME_MS = 2 * 60_000;

type LastSpot = Tile & { dir: Direction; at: number };

type SpaceRow = {
  width: number;
  height: number;
  tmjUrl: string | null;
  customMap: CustomMap | null;
  elements: (PlacedElement & { id: string })[];
  chat: ChatEntry[];
};

/** Loads a space into memory on first join and drops it when the last person leaves. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  // Concurrent joins to a space that isn't loaded yet share one load
  private readonly loading = new Map<string, Promise<Room | null>>();
  // Where people last stood, keyed by "spaceId:userId", kept for RESUME_MS after they leave
  private readonly lastSpots = new Map<string, LastSpot>();

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

  remember(spaceId: string, userId: string, spot: Tile & { dir: Direction }) {
    const now = Date.now();
    // Forget stale spots now and then, so the map can't grow without bound
    if (this.lastSpots.size > 1000) {
      for (const [key, s] of this.lastSpots) if (now - s.at > RESUME_MS) this.lastSpots.delete(key);
    }
    this.lastSpots.set(`${spaceId}:${userId}`, { ...spot, at: now });
  }

  /** Where this user stood when they last left the space, if that was recently. */
  recall(spaceId: string, userId: string): (Tile & { dir: Direction }) | null {
    const key = `${spaceId}:${userId}`;
    const spot = this.lastSpots.get(key);
    this.lastSpots.delete(key);
    return spot && Date.now() - spot.at <= RESUME_MS ? spot : null;
  }

  /**
   * Applies a change reported by apps/http. Spaces nobody is in are skipped: the next join loads fresh data
   * from the database. A load already in flight may or may not include the change, so wait for it and apply
   * anyway (adds are idempotent by id).
   */
  async applyEvent(spaceId: string, event: InternalEvent) {
    const room = this.rooms.get(spaceId) ?? (await this.loading.get(spaceId));
    if (!room) return;

    switch (event.type) {
      case "element-added":
        return room.addElement(event.payload);
      case "element-removed":
        return room.removeElement(event.payload.id);
      case "map-updated":
        return room.setCustomMap(event.payload);
      case "space-updated":
        room.setInfo(event.payload.name, event.payload.visibility);
        // Going private shuts out anyone who was only there because it was public
        if (event.payload.visibility === "Private") await this.recheckAccess(room);
        return;
      case "space-deleted":
        return room.closeAll(CLOSE_NOT_FOUND, "This space was deleted");
      case "access-changed":
        return this.recheckAccess(room, event.payload.userId);
    }
  }

  /** Applies a change to one user, in whichever room they're in. */
  applyUserEvent(userId: string, event: InternalUserEvent) {
    for (const room of this.rooms.values()) {
      if (event.type === "user-updated") room.get(userId)?.setAvatar(event.payload.avatarUrl);
    }
  }

  /**
   * Disconnects people in the room who may no longer enter it (same rule as joining: the owner, anyone when
   * it's public, or a member). One round trip for the whole room.
   */
  private async recheckAccess(room: Room, onlyUserId?: string) {
    const sessions = room.sessionList.filter((s) => !onlyUserId || s.userId === onlyUserId);
    const userIds = sessions.map((s) => s.userId!);
    if (userIds.length === 0) return;

    const rows = await client.$queryRaw<{ userId: string }[]>`
      SELECT u.id AS "userId"
      FROM "User" u, "Space" s
      WHERE s.id = ${room.spaceId}
        AND u.id = ANY(${userIds})
        AND (s."creatorId" = u.id OR s.visibility = 'Public'
          OR EXISTS (SELECT 1 FROM "SpaceMember" m WHERE m."spaceId" = s.id AND m."userId" = u.id))`;
    const allowed = new Set(rows.map((r) => r.userId));
    for (const session of sessions) {
      if (!allowed.has(session.userId!)) session.kick(CLOSE_FORBIDDEN, "You no longer have access to this space");
    }
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
        ) AS elements,
        (SELECT COALESCE(json_agg(c ORDER BY c.at), '[]') FROM (
          SELECT cm.id, cm."userId", u.username, cm.text, 'space' AS scope,
            to_char(cm."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at
          FROM "ChatMessage" cm
          JOIN "User" u ON u.id = cm."userId"
          WHERE cm."spaceId" = s.id AND cm."createdAt" > now() - make_interval(days => ${CHAT_RETENTION_DAYS})
          ORDER BY cm."createdAt" DESC
          LIMIT ${RECENT_CHAT}
        ) c) AS chat
      FROM "Space" s
      LEFT JOIN "Map" m ON m.id = s."mapId"
      LEFT JOIN "spaceElements" se ON se."spaceId" = s.id
      LEFT JOIN "Element" e ON e.id = se."elementId"
      WHERE s.id = ${spaceId}
      GROUP BY s.id, m."tmjUrl"`;

    const space = rows[0];
    if (!space) return null;

    const tiledMap = space.tmjUrl ? await loadTiledMap(space.tmjUrl) : null;
    const room = new Room(spaceId, space.width, space.height, tiledMap, space.elements, space.customMap, space.chat);
    this.rooms.set(spaceId, room);
    return room;
  }
}
