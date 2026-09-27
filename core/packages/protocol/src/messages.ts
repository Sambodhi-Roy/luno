import { z } from "zod";

// Wire format between the browser and apps/ws: JSON `{ type, payload }`.
// All positions are tile coordinates.

const tile = z.number().int();

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
  }),
});

export const clientMessageSchema = z.discriminatedUnion("type", [joinMessageSchema, moveMessageSchema]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

/* ---------- Server -> client ---------- */

export type Position = { x: number; y: number };

export type RemoteUser = Position & {
  userId: string;
  username: string;
  avatarUrl: string | null;
};

export type ServerMessage =
  // Sent to the joiner: where they spawn and who is already in the space (not including themselves)
  | { type: "space-joined"; payload: { spawn: Position; users: RemoteUser[] } }
  | { type: "user-join"; payload: RemoteUser }
  | { type: "movement"; payload: Position & { userId: string } }
  // Sent to the mover only, with their authoritative position to snap back to
  | { type: "movement-rejected"; payload: Position }
  | { type: "user-left"; payload: { userId: string } }
  | { type: "error"; payload: { message: string } };

export type ServerMessageType = ServerMessage["type"];
