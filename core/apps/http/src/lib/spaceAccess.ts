import client from "@repo/db/client";

export type Visibility = "Public" | "Private";

/**
 * The one rule for who may enter a space: its owner, anyone signed in when it's public, or a member (joined
 * through an invite or an earlier public visit). apps/ws applies the same rule when a socket joins.
 * Membership is only looked up when the answer depends on it, since each lookup is a database round trip.
 */
export async function canAccess(space: { id: string; creatorId: string; visibility: Visibility }, userId: string) {
  if (space.creatorId === userId || space.visibility === "Public") return true;
  const member = await client.spaceMember.findUnique({
    where: { userId_spaceId: { userId, spaceId: space.id } },
    select: { userId: true },
  });
  return member !== null;
}
