import { z } from "zod";
import { CHAT_MAX_LENGTH, DIRECTIONS, MAX_CUSTOM_STYLE, type CustomMap, type Direction } from "./rules.js";

// Wire format between the browser and apps/ws: JSON `{ type, payload }`.
// All positions are tile coordinates.

const tile = z.number().int();
const direction = z.enum(DIRECTIONS as [Direction, ...Direction[]]);

/* ---------- Client -> server ---------- */

export const joinMessageSchema = z.object({
  type: z.literal("join"),
  payload: z.object({
    spaceId: z.string().min(1),
    // Optional: browsers authenticate with the auth cookie sent on the WebSocket upgrade instead
    token: z.string().optional(),
  }),
});

export const moveMessageSchema = z.object({
  type: z.literal("movement"),
  payload: z.object({
    x: tile,
    y: tile,
    // The way the player now faces. Sending the current tile with a new direction just turns on the spot.
    dir: direction.optional(),
  }),
});

export const CHAT_SCOPES = ["nearby", "space"] as const;
// nearby: people within CHAT_RADIUS tiles, never stored. space: everyone in the space, kept for a while.
export type ChatScope = (typeof CHAT_SCOPES)[number];

export const chatMessageSchema = z.object({
  type: z.literal("chat"),
  payload: z.object({
    text: z.string().trim().min(1).max(CHAT_MAX_LENGTH),
    scope: z.enum(CHAT_SCOPES),
  }),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  joinMessageSchema,
  moveMessageSchema,
  chatMessageSchema,
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

/* ---------- Space furniture (shared by server -> client and api -> ws messages) ---------- */

export const spaceElementSchema = z.object({
  // The placement's id (a spaceElements row), not the catalogue element's id
  id: z.string().min(1),
  x: tile,
  y: tile,
  element: z.object({
    id: z.string().min(1),
    imageUrl: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    static: z.boolean(),
  }),
});

export type SpaceElement = z.infer<typeof spaceElementSchema>;

/* ---------- Custom maps (shared by the API, api -> ws events and server -> client messages) ---------- */

const styleIds = z.array(z.number().int().min(0).max(MAX_CUSTOM_STYLE));

/** A custom map's layout; callers also check both arrays hold width * height entries. */
export const customMapSchema = z.object({
  floor: styleIds,
  walls: styleIds,
  spawn: z.object({ x: tile, y: tile }).nullable().optional(),
}) satisfies z.ZodType<CustomMap>;

/* ---------- apps/http -> apps/ws (internal, authenticated with INTERNAL_SECRET) ---------- */

const visibility = z.enum(["Public", "Private"]);
export type Visibility = z.infer<typeof visibility>;

/** Something changed in one space: POSTed to /internal/spaces/:spaceId/events. */
export const internalEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("element-added"), payload: spaceElementSchema }),
  z.object({ type: z.literal("element-removed"), payload: z.object({ id: z.string().min(1) }) }),
  z.object({ type: z.literal("map-updated"), payload: customMapSchema }),
  // The owner renamed the space or changed who can enter
  z.object({ type: z.literal("space-updated"), payload: z.object({ name: z.string(), visibility }) }),
  z.object({ type: z.literal("space-deleted"), payload: z.object({}) }),
  // Someone may have lost access (e.g. left a private space): re-check that user, or everyone when omitted
  z.object({ type: z.literal("access-changed"), payload: z.object({ userId: z.string().min(1).optional() }) }),
]);

export type InternalEvent = z.infer<typeof internalEventSchema>;

/** Something changed about one user, wherever they are: POSTed to /internal/users/:userId/events. */
export const internalUserEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("user-updated"), payload: z.object({ avatarUrl: z.string().nullable() }) }),
]);

export type InternalUserEvent = z.infer<typeof internalUserEventSchema>;

/* ---------- Server -> client ---------- */

export type Position = { x: number; y: number };

export type RemoteUser = Position & {
  userId: string;
  username: string;
  avatarUrl: string | null;
  dir: Direction;
};

/** One chat message, as delivered to clients (and returned by GET /space/:id/messages). */
export type ChatEntry = {
  id: string;
  userId: string;
  username: string;
  text: string;
  scope: ChatScope;
  // ISO timestamp
  at: string;
};

export type ServerMessage =
  // Sent to the joiner: where they spawn, who is already in the space (not including themselves) and the
  // latest space-wide chat, oldest first. Nearby chat said before you arrived is never replayed.
  | { type: "space-joined"; payload: { spawn: Position; users: RemoteUser[]; chat: ChatEntry[] } }
  | { type: "user-join"; payload: RemoteUser }
  // A step or a turn on the spot
  | { type: "movement"; payload: Position & { userId: string; dir: Direction } }
  // Sent to the mover only, with their authoritative position to snap back to
  | { type: "movement-rejected"; payload: Position }
  | { type: "user-left"; payload: { userId: string } }
  // The space's furniture changed (placed or removed through the API)
  | { type: "element-added"; payload: SpaceElement }
  | { type: "element-removed"; payload: { id: string } }
  // The owner changed the custom map's floors or walls in the editor
  | { type: "map-updated"; payload: CustomMap }
  // Someone in the space (possibly you) changed their avatar
  | { type: "user-updated"; payload: { userId: string; avatarUrl: string | null } }
  // The owner renamed the space or changed its visibility
  | { type: "space-updated"; payload: { name: string; visibility: Visibility } }
  // A chat message you can hear (your own included)
  | { type: "chat"; payload: ChatEntry }
  // Sent to the sender only: their chat message wasn't delivered (e.g. sending too fast)
  | { type: "chat-rejected"; payload: { message: string } }
  | { type: "error"; payload: { message: string } };

export type ServerMessageType = ServerMessage["type"];
