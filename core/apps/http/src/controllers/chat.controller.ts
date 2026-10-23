import type { Request, Response } from "express";
import client, { CHAT_RETENTION_DAYS } from "@repo/db/client";
import type { ChatEntry } from "@repo/protocol";
import { chatHistoryQuerySchema } from "../types/index.js";

type AccessRow = { canAccess: boolean };

// A page of the space's saved (space-wide) chat, newest first. Nearby chat is never stored.
export const getChatHistory = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { spaceId } = req.params;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!spaceId) {
    return res.status(400).json({ message: "SpaceId param required" });
  }

  const parsed = chatHistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed" });
  }
  const { before, limit } = parsed.data;

  try {
    // Same rule as canAccess in lib/spaceAccess.ts, in one round trip
    const [space] = await client.$queryRaw<AccessRow[]>`
      SELECT (s."creatorId" = ${userId} OR s.visibility = 'Public'
        OR EXISTS (SELECT 1 FROM "SpaceMember" m WHERE m."spaceId" = s.id AND m."userId" = ${userId})) AS "canAccess"
      FROM "Space" s
      WHERE s.id = ${spaceId}`;

    if (!space) {
      return res.status(404).json({ message: "Space not found" });
    }

    if (!space.canAccess) {
      return res.status(403).json({ message: "This space is private" });
    }

    // One extra row tells whether there's an older page. Rows past the retention window are hidden even if
    // the periodic prune hasn't deleted them yet.
    const rows = await client.$queryRaw<(Omit<ChatEntry, "at" | "scope"> & { at: Date })[]>`
      SELECT cm.id, cm."userId", u.username, cm.text, cm."createdAt" AS at
      FROM "ChatMessage" cm
      JOIN "User" u ON u.id = cm."userId"
      WHERE cm."spaceId" = ${spaceId}
        AND cm."createdAt" > now() - make_interval(days => ${CHAT_RETENTION_DAYS})
        AND cm."createdAt" < ${before ? new Date(before) : new Date()}
      ORDER BY cm."createdAt" DESC
      LIMIT ${limit + 1}`;

    const messages: ChatEntry[] = rows.slice(0, limit).map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.username,
      text: r.text,
      scope: "space",
      at: r.at.toISOString(),
    }));
    return res.json({ messages, hasMore: rows.length > limit });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to load messages" });
  }
};
