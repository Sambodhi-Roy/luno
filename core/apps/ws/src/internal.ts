import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { internalEventSchema, internalUserEventSchema } from "@repo/protocol";
import type { RoomManager } from "./RoomManager.js";

// apps/http reports changes here so they can be pushed to everyone affected: furniture, maps and settings of a
// space (/internal/spaces/:id/events), or a user's avatar (/internal/users/:id/events).
// Not for browsers: requests must carry the shared INTERNAL_SECRET.

const ROUTE = /^\/internal\/(spaces|users)\/([^/]+)\/events$/;
// Events are small JSON objects; the largest is a custom map (two arrays of one id per tile, a few KB)
const MAX_BODY_BYTES = 64 * 1024;

export async function handleInternalRequest(req: IncomingMessage, res: ServerResponse, rooms: RoomManager) {
  const match = req.method === "POST" ? ROUTE.exec(req.url ?? "") : null;
  if (!match) return reply(res, 404, "Not found");
  if (!isAuthorized(req.headers.authorization)) return reply(res, 401, "Unauthorized");

  let body: unknown;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return reply(res, 400, "Invalid body");
  }

  const id = decodeURIComponent(match[2]!);
  if (match[1] === "users") {
    const parsed = internalUserEventSchema.safeParse(body);
    if (!parsed.success) return reply(res, 400, "Invalid event");
    rooms.applyUserEvent(id, parsed.data);
    return reply(res, 204);
  }

  const parsed = internalEventSchema.safeParse(body);
  if (!parsed.success) return reply(res, 400, "Invalid event");

  await rooms.applyEvent(id, parsed.data);
  reply(res, 204);
}

function isAuthorized(header: string | undefined) {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  // Constant-time comparison, so the secret can't be guessed from response timing
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function reply(res: ServerResponse, status: number, message?: string) {
  if (res.headersSent) return;
  res.writeHead(status, message ? { "Content-Type": "application/json" } : {});
  res.end(message ? JSON.stringify({ message }) : undefined);
}
