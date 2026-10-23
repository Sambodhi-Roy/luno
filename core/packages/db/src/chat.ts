import type { PrismaClient } from "@prisma/client";

// Space-wide chat is kept for this long, and only the latest CHAT_KEEP_PER_SPACE messages of each space
export const CHAT_RETENTION_DAYS = 30;
export const CHAT_KEEP_PER_SPACE = 500;

/** Deletes chat messages past the retention limits. Returns how many rows were removed. */
export async function pruneChatMessages(client: PrismaClient): Promise<number> {
  const expired = await client.$executeRaw`
    DELETE FROM "ChatMessage" WHERE "createdAt" < now() - make_interval(days => ${CHAT_RETENTION_DAYS})`;
  const overflow = await client.$executeRaw`
    DELETE FROM "ChatMessage" m USING (
      SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY "spaceId" ORDER BY "createdAt" DESC) AS rn FROM "ChatMessage"
      ) ranked WHERE rn > ${CHAT_KEEP_PER_SPACE}
    ) old
    WHERE m.id = old.id`;
  return expired + overflow;
}
