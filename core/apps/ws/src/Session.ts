import { randomUUID } from "node:crypto";
import client from "@repo/db/client";
import {
  clientMessageSchema,
  directionOf,
  isSingleStep,
  STEP_MS,
  type ChatEntry,
  type ChatScope,
  type ClientMessage,
  type Direction,
  type RemoteUser,
  type ServerMessage,
} from "@repo/protocol";
import { WebSocket } from "ws";
import { verifyToken } from "./auth.js";
import type { Room } from "./Room.js";
import type { RoomManager } from "./RoomManager.js";

// Accept steps a bit faster than the client's animation pace, so network jitter doesn't cause rejections
const MIN_STEP_INTERVAL_MS = STEP_MS / 2;
// At most CHAT_BURST chat messages in any CHAT_WINDOW_MS
const CHAT_BURST = 5;
const CHAT_WINDOW_MS = 5_000;

// Application close codes (4000-4999 are free for app use)
export const CLOSE_REPLACED = 4000;
export const CLOSE_UNAUTHORIZED = 4001;
export const CLOSE_FORBIDDEN = 4003;
export const CLOSE_NOT_FOUND = 4004;

type JoiningUser = { username: string; avatarUrl: string | null; canAccess: boolean };

/** One WebSocket connection. It joins at most one space. */
export class Session {
  userId: string | undefined;
  x = 0;
  y = 0;
  dir: Direction = "down";
  private username = "";
  private avatarUrl: string | null = null;
  private room: Room | undefined;
  private joining = false;
  private lastStepAt = 0;
  // When this session's recent chat messages were sent, oldest first (for the rate limit)
  private chatTimes: number[] = [];

  constructor(
    private readonly ws: WebSocket,
    private readonly rooms: RoomManager,
    // Auth cookie from the upgrade request; used when the join message carries no token
    private readonly cookieToken: string | undefined
  ) {
    ws.on("message", (data) => {
      this.onMessage(data.toString()).catch((e) => {
        console.error("ws: failed to handle message", e);
        this.send({ type: "error", payload: { message: "Server error" } });
      });
    });
    ws.on("close", () => this.leave());
  }

  send(message: ServerMessage) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  toRemoteUser(): RemoteUser {
    return {
      userId: this.userId!,
      username: this.username,
      avatarUrl: this.avatarUrl,
      x: this.x,
      y: this.y,
      dir: this.dir,
    };
  }

  /** The user picked another avatar: everyone in the room (them included) redraws them. */
  setAvatar(avatarUrl: string | null) {
    if (!this.room || avatarUrl === this.avatarUrl) return;
    this.avatarUrl = avatarUrl;
    this.room.broadcast({ type: "user-updated", payload: { userId: this.userId!, avatarUrl } });
  }

  /** Disconnects with an app close code (lost access, space deleted). The close handler does the leaving. */
  kick(code: number, message: string) {
    this.send({ type: "error", payload: { message } });
    this.ws.close(code, message);
  }

  private async onMessage(raw: string) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return this.send({ type: "error", payload: { message: "Messages must be JSON" } });
    }

    const parsed = clientMessageSchema.safeParse(json);
    if (!parsed.success) {
      return this.send({ type: "error", payload: { message: "Invalid message" } });
    }

    const message: ClientMessage = parsed.data;
    if (message.type === "join") return this.join(message.payload.spaceId, message.payload.token);
    if (message.type === "chat") return this.chat(message.payload.text, message.payload.scope);
    return this.move(message.payload.x, message.payload.y, message.payload.dir);
  }

  private async join(spaceId: string, token: string | undefined) {
    if (this.room || this.joining) {
      return this.send({ type: "error", payload: { message: "Already joined a space" } });
    }
    this.joining = true;

    const userId = verifyToken(token ?? this.cookieToken);
    if (!userId) return this.reject(CLOSE_UNAUTHORIZED, "Unauthorized");

    // Independent lookups, so run them together (each is a round trip to the database)
    const [user, loadedRoom] = await Promise.all([findJoiningUser(userId, spaceId), this.rooms.get(spaceId)]);

    // The room can be released while we await (last person left), so retry until we hold a live one
    let room = loadedRoom;
    while (room && !this.rooms.isLive(room)) room = await this.rooms.get(spaceId);

    if (!user) {
      if (room) this.rooms.releaseIfEmpty(room);
      return this.reject(CLOSE_UNAUTHORIZED, "Unauthorized");
    }
    if (!room) return this.reject(CLOSE_NOT_FOUND, "Space not found");
    if (!user.canAccess) {
      this.rooms.releaseIfEmpty(room);
      return this.reject(CLOSE_FORBIDDEN, "This space is private");
    }
    if (this.ws.readyState !== WebSocket.OPEN) return this.rooms.releaseIfEmpty(room);

    // Same user joining again (another tab): the new session takes over, where the old one stood
    const previous = room.get(userId);
    if (previous) previous.replace();
    const comingBack = previous ?? this.rooms.recall(spaceId, userId);

    this.userId = userId;
    this.username = user.username;
    this.avatarUrl = user.avatarUrl;
    ({ x: this.x, y: this.y } = room.findSpawn(comingBack));
    if (comingBack) this.dir = comingBack.dir;
    this.room = room;
    room.add(this);

    this.send({
      type: "space-joined",
      payload: { spawn: { x: this.x, y: this.y }, users: room.users(this), chat: room.recentChat },
    });
    room.broadcast({ type: "user-join", payload: this.toRemoteUser() }, this);
  }

  private move(x: number, y: number, dir: Direction | undefined) {
    const room = this.room;
    if (!room) {
      return this.send({ type: "error", payload: { message: "Join a space before moving" } });
    }

    // Turning on the spot (e.g. bumping into a wall): no step, so no pace limit
    if (x === this.x && y === this.y && dir) {
      if (dir === this.dir) return;
      this.dir = dir;
      return room.broadcast({ type: "movement", payload: { userId: this.userId!, x, y, dir } }, this);
    }

    const now = Date.now();
    const valid =
      isSingleStep(this, { x, y }) && room.grid.isWalkable(x, y) && now - this.lastStepAt >= MIN_STEP_INTERVAL_MS;

    if (!valid) {
      return this.send({ type: "movement-rejected", payload: { x: this.x, y: this.y } });
    }

    this.dir = dir ?? directionOf(this, { x, y }) ?? this.dir;
    this.x = x;
    this.y = y;
    this.lastStepAt = now;
    room.broadcast({ type: "movement", payload: { userId: this.userId!, x, y, dir: this.dir } }, this);
  }

  /**
   * Nearby chat goes to everyone within CHAT_RADIUS tiles and is never stored. Space chat goes to everyone in
   * the space and is saved first, so it shows up in the history of people who join later.
   */
  private async chat(text: string, scope: ChatScope) {
    const room = this.room;
    if (!room) {
      return this.send({ type: "chat-rejected", payload: { message: "Join a space before chatting" } });
    }

    const now = Date.now();
    this.chatTimes = this.chatTimes.filter((t) => now - t < CHAT_WINDOW_MS);
    if (this.chatTimes.length >= CHAT_BURST) {
      return this.send({ type: "chat-rejected", payload: { message: "You're sending messages too fast" } });
    }
    this.chatTimes.push(now);

    const entry: ChatEntry = {
      id: randomUUID(),
      userId: this.userId!,
      username: this.username,
      text,
      scope,
      at: new Date(now).toISOString(),
    };
    if (scope === "nearby") return room.broadcastNear(this, { type: "chat", payload: entry });

    await client.$executeRaw`
      INSERT INTO "ChatMessage" (id, "spaceId", "userId", text, "createdAt")
      VALUES (${entry.id}, ${room.spaceId}, ${entry.userId}, ${text}, ${new Date(now)})`;
    room.addChat(entry);
  }

  /** Called when the same user joins from elsewhere: drop this connection without announcing a leave. */
  private replace() {
    this.send({ type: "error", payload: { message: "You joined this space from another tab" } });
    this.ws.close(CLOSE_REPLACED, "Replaced by a newer session");
  }

  private reject(code: number, message: string) {
    this.joining = false;
    this.send({ type: "error", payload: { message } });
    this.ws.close(code, message);
  }

  private leave() {
    const room = this.room;
    if (!room) return;
    this.room = undefined;

    // A replaced session is no longer in the room, so its leave isn't announced
    if (room.remove(this)) {
      room.broadcast({ type: "user-left", payload: { userId: this.userId! } });
      // Coming back soon (a reload, a dropped connection) puts them back here
      this.rooms.remember(room.spaceId, this.userId!, { x: this.x, y: this.y, dir: this.dir });
    }
    this.rooms.releaseIfEmpty(room);
  }
}

/**
 * The joining user's name and avatar, plus whether they may enter the space: its owner, anyone when it's
 * public, or a member. Same rule as canAccess in apps/http. Read on every join rather than cached on the
 * room, so a space switched to private takes effect for the next join. One round trip.
 */
async function findJoiningUser(userId: string, spaceId: string): Promise<JoiningUser | null> {
  const rows = await client.$queryRaw<JoiningUser[]>`
    SELECT u.username, a."imageUrl" AS "avatarUrl",
      EXISTS (
        SELECT 1 FROM "Space" s
        WHERE s.id = ${spaceId}
          AND (s."creatorId" = u.id OR s.visibility = 'Public'
            OR EXISTS (SELECT 1 FROM "SpaceMember" m WHERE m."spaceId" = s.id AND m."userId" = u.id))
      ) AS "canAccess"
    FROM "User" u
    LEFT JOIN "Avatar" a ON a.id = u."avatarId"
    WHERE u.id = ${userId}`;
  return rows[0] ?? null;
}
