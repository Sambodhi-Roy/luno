import client from "@repo/db/client";
import {
  clientMessageSchema,
  isSingleStep,
  STEP_MS,
  type ClientMessage,
  type RemoteUser,
  type ServerMessage,
} from "@repo/protocol";
import { WebSocket } from "ws";
import { verifyToken } from "./auth.js";
import type { Room } from "./Room.js";
import type { RoomManager } from "./RoomManager.js";

// Accept steps a bit faster than the client's animation pace, so network jitter doesn't cause rejections
const MIN_STEP_INTERVAL_MS = STEP_MS / 2;

// Application close codes (4000-4999 are free for app use)
const CLOSE_REPLACED = 4000;
const CLOSE_UNAUTHORIZED = 4001;
const CLOSE_NOT_FOUND = 4004;

/** One WebSocket connection. It joins at most one space. */
export class Session {
  userId: string | undefined;
  x = 0;
  y = 0;
  private username = "";
  private avatarUrl: string | null = null;
  private room: Room | undefined;
  private joining = false;
  private lastStepAt = 0;

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
    };
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
    return this.move(message.payload.x, message.payload.y);
  }

  private async join(spaceId: string, token: string | undefined) {
    if (this.room || this.joining) {
      return this.send({ type: "error", payload: { message: "Already joined a space" } });
    }
    this.joining = true;

    const userId = verifyToken(token ?? this.cookieToken);
    if (!userId) return this.reject(CLOSE_UNAUTHORIZED, "Unauthorized");

    // Independent lookups, so run them together (each is a round trip to the database)
    const [user, loadedRoom] = await Promise.all([
      client.user.findUnique({
        where: { id: userId },
        select: { username: true, avatar: { select: { imageUrl: true } } },
      }),
      this.rooms.get(spaceId),
    ]);

    // The room can be released while we await (last person left), so retry until we hold a live one
    let room = loadedRoom;
    while (room && !this.rooms.isLive(room)) room = await this.rooms.get(spaceId);

    if (!user) {
      if (room) this.rooms.releaseIfEmpty(room);
      return this.reject(CLOSE_UNAUTHORIZED, "Unauthorized");
    }
    if (!room) return this.reject(CLOSE_NOT_FOUND, "Space not found");
    if (this.ws.readyState !== WebSocket.OPEN) return this.rooms.releaseIfEmpty(room);

    // Same user joining again (another tab): the new session takes over
    const previous = room.get(userId);
    if (previous) previous.replace();

    this.userId = userId;
    this.username = user.username;
    this.avatarUrl = user.avatar?.imageUrl ?? null;
    ({ x: this.x, y: this.y } = room.findSpawn());
    this.room = room;
    room.add(this);

    this.send({
      type: "space-joined",
      payload: { spawn: { x: this.x, y: this.y }, users: room.users(this) },
    });
    room.broadcast({ type: "user-join", payload: this.toRemoteUser() }, this);
  }

  private move(x: number, y: number) {
    const room = this.room;
    if (!room) {
      return this.send({ type: "error", payload: { message: "Join a space before moving" } });
    }

    const now = Date.now();
    const valid =
      isSingleStep(this, { x, y }) && room.grid.isWalkable(x, y) && now - this.lastStepAt >= MIN_STEP_INTERVAL_MS;

    if (!valid) {
      return this.send({ type: "movement-rejected", payload: { x: this.x, y: this.y } });
    }

    this.x = x;
    this.y = y;
    this.lastStepAt = now;
    room.broadcast({ type: "movement", payload: { userId: this.userId!, x, y } }, this);
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
    }
    this.rooms.releaseIfEmpty(room);
  }
}
