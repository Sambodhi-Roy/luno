import type { CollisionGrid, Position, RemoteUser, ServerMessage } from "@repo/protocol";
import type { Session } from "./Session.js";

/** Everyone currently connected to one space, plus that space's walkability grid. */
export class Room {
  // One session per user: joining again (e.g. a second tab) replaces the previous session
  private readonly sessions = new Map<string, Session>();

  constructor(
    readonly spaceId: string,
    readonly grid: CollisionGrid
  ) {}

  get isEmpty() {
    return this.sessions.size === 0;
  }

  get(userId: string) {
    return this.sessions.get(userId);
  }

  add(session: Session) {
    this.sessions.set(session.userId!, session);
  }

  /** Removes the session; returns false if a newer session for the same user had already replaced it. */
  remove(session: Session) {
    if (this.sessions.get(session.userId!) !== session) return false;
    this.sessions.delete(session.userId!);
    return true;
  }

  users(except?: Session): RemoteUser[] {
    return [...this.sessions.values()].filter((s) => s !== except).map((s) => s.toRemoteUser());
  }

  broadcast(message: ServerMessage, except?: Session) {
    for (const session of this.sessions.values()) {
      if (session !== except) session.send(message);
    }
  }

  /**
   * First walkable tile, searching outward from the centre in growing rings, that nobody is standing on.
   * Falls back to an occupied walkable tile when the space is full.
   */
  findSpawn(): Position {
    const occupied = new Set([...this.sessions.values()].map((s) => `${s.x},${s.y}`));
    const cx = Math.floor(this.grid.width / 2);
    const cy = Math.floor(this.grid.height / 2);
    const maxRadius = Math.max(this.grid.width, this.grid.height);
    let fallback: Position | null = null;

    for (let r = 0; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          // Only the ring at distance r; inner tiles were checked in earlier rounds
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (!this.grid.isWalkable(x, y)) continue;
          if (!occupied.has(`${x},${y}`)) return { x, y };
          fallback ??= { x, y };
        }
      }
    }

    return fallback ?? { x: cx, y: cy };
  }
}
