import type { Request, Response } from "express";
import client from "@repo/db/client";
import type { Visibility } from "../lib/spaceAccess.js";

// How many public spaces Explore lists
const EXPLORE_LIMIT = 50;

type SpaceRow = {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail: string | null;
  mapId: string | null;
  visibility: Visibility;
  ownerUsername: string;
  lastVisitedAt: Date | null;
};

// Same fields as GET /space/all, plus who owns the space
const formatSpace = (row: SpaceRow) => ({
  id: row.id,
  name: row.name,
  dimensions: `${row.width}x${row.height}`,
  thumbnail: row.thumbnail,
  mapId: row.mapId,
  visibility: row.visibility,
  ownerUsername: row.ownerUsername,
  lastVisitedAt: row.lastVisitedAt?.toISOString() ?? null,
});

// Spaces the caller has joined but doesn't own, most recently visited first.
// One SQL join: the nested Prisma query costs a round trip per relation.
export const getJoinedSpaces = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const rows = await client.$queryRaw<SpaceRow[]>`
      SELECT s.id, s.name, s.width, s.height, s.thumbnail, s."mapId", s.visibility,
        u.username AS "ownerUsername", m."lastVisitedAt"
      FROM "SpaceMember" m
      JOIN "Space" s ON s.id = m."spaceId"
      JOIN "User" u ON u.id = s."creatorId"
      WHERE m."userId" = ${userId}
      ORDER BY m."lastVisitedAt" DESC`;

    return res.status(200).json({ spaces: rows.map(formatSpace) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// Public spaces by other people, newest first
export const getPublicSpaces = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const rows = await client.$queryRaw<SpaceRow[]>`
      SELECT s.id, s.name, s.width, s.height, s.thumbnail, s."mapId", s.visibility,
        u.username AS "ownerUsername", NULL AS "lastVisitedAt"
      FROM "Space" s
      JOIN "User" u ON u.id = s."creatorId"
      WHERE s.visibility = 'Public' AND s."creatorId" <> ${userId}
      ORDER BY s."createdAt" DESC
      LIMIT ${EXPLORE_LIMIT}`;

    return res.status(200).json({ spaces: rows.map(formatSpace) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// Records that the caller entered a space, which puts it on their dashboard. Anyone may join a public space
// this way; a private one needs an invite first. The owner has nothing to record.
export const visitSpace = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { spaceId } = req.params;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (!spaceId) {
    return res.status(400).json({
      message: "SpaceId param is required",
    });
  }

  try {
    const space = await client.space.findUnique({
      where: { id: spaceId },
      select: { creatorId: true, visibility: true },
    });

    if (!space) {
      return res.status(404).json({
        message: "Space not found",
      });
    }

    if (space.creatorId === userId) {
      return res.status(200).json({ message: "Visit recorded" });
    }

    const now = new Date();

    if (space.visibility === "Public") {
      await client.spaceMember.upsert({
        where: { userId_spaceId: { userId, spaceId } },
        create: { userId, spaceId },
        update: { lastVisitedAt: now },
      });
    } else {
      // Only existing members can be in a private space, so there's nothing to create
      const { count } = await client.spaceMember.updateMany({
        where: { userId, spaceId },
        data: { lastVisitedAt: now },
      });
      if (count === 0) {
        return res.status(403).json({
          message: "This space is private",
        });
      }
    }

    return res.status(200).json({ message: "Visit recorded" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// Removes a joined space from the caller's dashboard. For a private space this also gives up access.
export const leaveSpace = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { spaceId } = req.params;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (!spaceId) {
    return res.status(400).json({
      message: "SpaceId param is required",
    });
  }

  try {
    const { count } = await client.spaceMember.deleteMany({
      where: { userId, spaceId },
    });

    if (count === 0) {
      return res.status(404).json({
        message: "You are not a member of this space",
      });
    }

    return res.status(200).json({ message: "Left space" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

const findInvite = (code: string, userId: string) =>
  client.space.findUnique({
    where: { inviteCode: code },
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      thumbnail: true,
      visibility: true,
      creatorId: true,
      creator: { select: { username: true } },
      // The caller's own membership, if any, so the invite page can say "Enter" instead of "Join"
      members: { where: { userId }, select: { userId: true } },
    },
  });

// What the invite page shows before the user accepts
export const getInvite = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { code } = req.params;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (!code) {
    return res.status(400).json({
      message: "Invite code is required",
    });
  }

  try {
    const space = await findInvite(code, userId);

    if (!space) {
      return res.status(404).json({
        message: "This invite link is invalid or has been reset",
      });
    }

    return res.status(200).json({
      spaceId: space.id,
      name: space.name,
      dimensions: `${space.width}x${space.height}`,
      thumbnail: space.thumbnail,
      ownerUsername: space.creator.username,
      visibility: space.visibility,
      isOwner: space.creatorId === userId,
      isMember: space.members.length > 0,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// Accepting an invite makes the caller a member, which is what lets them into a private space
export const acceptInvite = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { code } = req.params;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (!code) {
    return res.status(400).json({
      message: "Invite code is required",
    });
  }

  try {
    const space = await client.space.findUnique({
      where: { inviteCode: code },
      select: { id: true, creatorId: true },
    });

    if (!space) {
      return res.status(404).json({
        message: "This invite link is invalid or has been reset",
      });
    }

    if (space.creatorId !== userId) {
      await client.spaceMember.upsert({
        where: { userId_spaceId: { userId, spaceId: space.id } },
        create: { userId, spaceId: space.id },
        update: {},
      });
    }

    return res.status(200).json({
      message: "Joined space",
      spaceId: space.id,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
