import {
  buildCollisionGrid,
  type CollisionGrid,
  type CustomMap,
  type PlacedElement,
  type Position,
  type RemoteUser,
  type ServerMessage,
  type SpaceElement,
  type Tile,
  type TiledMap,
  type Visibility,
  tiledSpawnTiles,
} from "@repo/protocol";
import type { Session } from "./Session.js";

/** Everyone currently connected to one space, plus that space's furniture and walkability grid. */
export class Room {
  // One session per user: joining again (e.g. a second tab) replaces the previous session
  private readonly sessions = new Map<string, Session>();
  // Keyed by placement (spaceElements row) id
  private readonly elements: Map<string, PlacedElement>;
  private _grid: CollisionGrid;
  // Spawn tiles marked in the Tiled map (a custom map's spawn is read from customMap, which can change)
  private readonly tiledSpawns: Tile[];

  constructor(
    readonly spaceId: string,
    private readonly width: number,
    private readonly height: number,
    private readonly tiledMap: TiledMap | null,
    elements: (PlacedElement & { id: string })[],
    // Floors and walls of a map built in the editor, instead of a Tiled map
    private customMap: CustomMap | null = null
  ) {
    this.elements = new Map(elements.map(({ id, ...placed }) => [id, placed]));
    this._grid = this.buildGrid();
    this.tiledSpawns = tiledMap ? tiledSpawnTiles(tiledMap) : [];
  }

  get grid() {
    return this._grid;
  }

  /** Furniture was placed through the API: block its tiles and tell everyone. Repeats are ignored. */
  addElement(placed: SpaceElement) {
    if (this.elements.has(placed.id)) return;
    this.elements.set(placed.id, { x: placed.x, y: placed.y, ...placed.element });
    this._grid = this.buildGrid();
    this.broadcast({ type: "element-added", payload: placed });
  }

  removeElement(id: string) {
    if (!this.elements.delete(id)) return;
    this._grid = this.buildGrid();
    this.broadcast({ type: "element-removed", payload: { id } });
  }

  /** The owner changed the custom map's floors or walls in the editor: re-check walkability and tell everyone. */
  setCustomMap(map: CustomMap) {
    this.customMap = map;
    this._grid = this.buildGrid();
    this.broadcast({ type: "map-updated", payload: map });
  }

  /** The owner renamed the space or changed its visibility. */
  setInfo(name: string, visibility: Visibility) {
    this.broadcast({ type: "space-updated", payload: { name, visibility } });
  }

  /** Disconnects everyone (e.g. the space was deleted). Their sockets' close handlers do the leaving. */
  closeAll(code: number, reason: string) {
    for (const session of [...this.sessions.values()]) session.kick(code, reason);
  }

  get sessionList() {
    return [...this.sessions.values()];
  }

  private buildGrid() {
    return buildCollisionGrid(this.width, this.height, this.tiledMap, [...this.elements.values()], this.customMap);
  }

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
   * Where someone entering appears: their previous spot if they're coming back (and it's still walkable), else
   * a free spawn tile marked on the map, else the free walkable tile nearest the marked spawn or the centre.
   */
  findSpawn(preferred?: Tile | null): Position {
    if (preferred && this.grid.isWalkable(preferred.x, preferred.y)) return { x: preferred.x, y: preferred.y };

    const occupied = new Set([...this.sessions.values()].map((s) => `${s.x},${s.y}`));
    const marked = (this.customMap?.spawn ? [this.customMap.spawn] : this.tiledSpawns).filter((t) =>
      this.grid.isWalkable(t.x, t.y)
    );
    const free = marked.filter((t) => !occupied.has(`${t.x},${t.y}`));
    if (free.length > 0) return { ...free[Math.floor(Math.random() * free.length)]! };

    const centre = marked[0] ?? { x: Math.floor(this.grid.width / 2), y: Math.floor(this.grid.height / 2) };
    return this.nearestFree(centre, occupied);
  }

  /**
   * First walkable tile nobody is standing on, searching outward from `centre` in growing rings.
   * Falls back to an occupied walkable tile when the space is full.
   */
  private nearestFree(centre: Tile, occupied: Set<string>): Position {
    const maxRadius = Math.max(this.grid.width, this.grid.height);
    let fallback: Position | null = null;

    for (let r = 0; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          // Only the ring at distance r; inner tiles were checked in earlier rounds
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = centre.x + dx;
          const y = centre.y + dy;
          if (!this.grid.isWalkable(x, y)) continue;
          if (!occupied.has(`${x},${y}`)) return { x, y };
          fallback ??= { x, y };
        }
      }
    }

    return fallback ?? centre;
  }
}
