import type { Request, Response } from "express";
import client from "@repo/db/client";
import { randomUUID } from "node:crypto";
import { createSpaceSchema, addElementSchema, deleteElementSchema, updateSpaceSchema } from "../types/index.js";
import { notifySpace } from "../lib/realtime.js";
import { canAccess } from "../lib/spaceAccess.js";

const parseDimensions = (dimensions: string) => {
  const [widthStr, heightStr] = dimensions.split("x") as [string, string];
  return {
    width: parseInt(widthStr, 10),
    height: parseInt(heightStr, 10),
  };
};

export const createSpace = async (req: Request, res: Response) => {
  const parsedData = createSpaceSchema.safeParse(req.body);

  if (!parsedData.success) {
    return res.status(400).json({
      message: "Validation failed",
    });
  }

  const { name, dimensions, mapId, visibility } = parsedData.data;

  const creatorId = req.user?.id;

  if (!creatorId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const map = mapId
      ? await client.map.findUnique({
          where: { id: mapId },
          include: { mapElements: true },
        })
      : null;

    if (mapId && !map) {
      return res.status(400).json({
        message: "Invalid mapId",
      });
    }

    // Explicit dimensions win; otherwise the space takes the map's size
    const { width, height } = dimensions
      ? parseDimensions(dimensions)
      : { width: map!.width, height: map!.height };

    const space = await client.$transaction(async (tx) => {
      const createdSpace = await tx.space.create({
        data: {
          name,
          width,
          height,
          creatorId,
          visibility,
          ...(map && { mapId: map.id, thumbnail: map.thumbnail }),
        },
      });

      // Each space gets its own editable copy of the map's default elements
      const defaults = (map?.mapElements ?? []).filter(
        (me) => me.x !== null && me.y !== null
      );

      if (defaults.length > 0) {
        await tx.spaceElements.createMany({
          data: defaults.map((me) => ({
            spaceId: createdSpace.id,
            elementId: me.elementId,
            x: me.x!,
            y: me.y!,
          })),
        });
      }

      return createdSpace;
    });

    return res.status(200).json({
      message: "Space created successfully",
      spaceId: space.id,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getAllSpaces = async (req: Request, res: Response) => {
  const creatorId = req.user?.id;

  if (!creatorId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const spaces = await client.space.findMany({
      where: { creatorId },
      select: {
        id: true,
        name: true,
        width: true,
        height: true,
        thumbnail: true,
        mapId: true,
        visibility: true,
        inviteCode: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedSpaces = spaces.map((space) => ({
      id: space.id,
      name: space.name,
      dimensions: `${space.width}x${space.height}`,
      thumbnail: space.thumbnail ?? null,
      mapId: space.mapId ?? null,
      visibility: space.visibility,
      // Safe to include: this list only ever holds the caller's own spaces
      inviteCode: space.inviteCode,
    }));

    return res.status(200).json({ spaces: formattedSpaces });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Error fetching spaces, Internal server error" });
  }
};

// Owners, members, and anyone for a public space (see canAccess)
export const getSpace = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { spaceId } = req.params;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (!spaceId) {
    return res.status(400).json({
      message: "SpaceId param required",
    });
  }

  try {
    const space = await client.space.findUnique({
      where: { id: spaceId },
      include: {
        map: { select: { tmjUrl: true } },
        elements: {
          include: {
            element: true,
          },
        },
      },
    });

    if (!space) {
      return res.status(404).json({
        message: "Space not found",
      });
    }

    if (!(await canAccess(space, userId))) {
      return res.status(403).json({
        message: "This space is private",
      });
    }

    const elements = space.elements.map((se) => ({
      id: se.id,
      element: {
        id: se.element.id,
        imageUrl: se.element.imageUrl,
        height: se.element.height,
        width: se.element.width,
        static: se.element.static,
      },
      x: se.x,
      y: se.y,
    }));

    return res.status(200).json({
      id: space.id,
      name: space.name,
      dimensions: `${space.width}x${space.height}`,
      mapId: space.mapId ?? null,
      tmjUrl: space.map?.tmjUrl ?? null,
      creatorId: space.creatorId,
      visibility: space.visibility,
      // The invite link is the key to a private space, so only its owner sees it
      ...(space.creatorId === userId && { inviteCode: space.inviteCode }),
      elements,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const updateSpace = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { spaceId } = req.params;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const parsed = updateSpaceSchema.safeParse(req.body);
  if (!spaceId || !parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
    });
  }

  const { name, visibility } = parsed.data;

  try {
    const space = await client.space.findUnique({
      where: { id: spaceId },
      select: { creatorId: true },
    });

    if (!space) {
      return res.status(404).json({
        message: "Space not found",
      });
    }

    if (space.creatorId !== userId) {
      return res.status(403).json({
        message: "You do not have permission to modify this space",
      });
    }

    // People already inside a space that turns private stay until they leave; new joins are checked
    const updated = await client.space.update({
      where: { id: spaceId },
      data: {
        ...(name !== undefined && { name }),
        ...(visibility !== undefined && { visibility }),
      },
      select: { id: true, name: true, visibility: true },
    });

    return res.status(200).json({
      message: "Space updated successfully",
      space: updated,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// A new code makes old invite links stop working; people who already joined stay members
export const resetInviteCode = async (req: Request, res: Response) => {
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
      select: { creatorId: true },
    });

    if (!space) {
      return res.status(404).json({
        message: "Space not found",
      });
    }

    if (space.creatorId !== userId) {
      return res.status(403).json({
        message: "You do not have permission to modify this space",
      });
    }

    const { inviteCode } = await client.space.update({
      where: { id: spaceId },
      data: { inviteCode: randomUUID().replaceAll("-", "") },
      select: { inviteCode: true },
    });

    return res.status(200).json({
      message: "Invite link reset",
      inviteCode,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const deleteSpace = async (req: Request, res: Response) => {
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
      select: { creatorId: true },
    });

    if (!space) {
      return res.status(404).json({
        message: "Space not found",
      });
    }

    if (space.creatorId !== userId) {
      return res.status(403).json({
        message: "You do not have permission to delete this space",
      });
    }

    // spaceElements are removed by the onDelete: Cascade relation
    await client.space.delete({
      where: { id: spaceId },
    });

    return res.status(200).json({
      message: "Space deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getAllElements = async (req: Request, res: Response) => {
  try {
    const elements = await client.element.findMany({
      select: {
        id: true,
        imageUrl: true,
        width: true,
        height: true,
        static: true,
      },
      // Stable palette order; seeded ids (seed-element-<name>) group related pieces
      orderBy: { id: "asc" },
    });

    return res.status(200).json({
      elements,
    });
  } catch (e) {
    console.error("Error fetching elements", e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const addElementToSpace = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const parsed = addElementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error,
    });
  }

  const { spaceId, elementId, x, y } = parsed.data;

  try {
    const space = await client.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      return res.status(404).json({
        message: "Space not found",
      });
    }

    if (space.creatorId !== userId) {
      return res.status(403).json({
        message: "You do not have permission to modify this space",
      });
    }

    const element = await client.element.findUnique({
      where: { id: elementId },
    });

    if (!element) {
      return res.status(404).json({
        message: "Element not found",
      });
    }

    // The whole element footprint must fit inside the space
    if (x + element.width > space.width || y + element.height > space.height) {
      return res.status(400).json({
        message: "Element lies outside the space boundary",
      });
    }

    const spaceElement = await client.spaceElements.create({
      data: {
        spaceId,
        elementId,
        x,
        y,
      },
    });

    // Same shape the WebSocket server broadcasts, so the caller can draw it straight away
    const placed = {
      id: spaceElement.id,
      x,
      y,
      element: {
        id: element.id,
        imageUrl: element.imageUrl,
        width: element.width,
        height: element.height,
        static: element.static,
      },
    };
    notifySpace(spaceId, { type: "element-added", payload: placed });

    return res.status(200).json({
      message: "Element added to space successfully",
      element: { ...placed, elementId },
    });
  } catch (e) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const removeElementFromSpace = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const parsed = deleteElementSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "spaceElement id is required",
    });
  }

  try {
    const { id } = parsed.data;

    const spaceElement = await client.spaceElements.findUnique({
      where: { id },
      include: {
        space: true,
      },
    });

    if (!spaceElement) {
      return res.status(404).json({
        message: "Space element not found",
      });
    }

    if (spaceElement.space.creatorId !== userId) {
      return res.status(403).json({
        message: "You do not have permission to modify this space",
      });
    }

    await client.spaceElements.delete({
      where: { id },
    });
    notifySpace(spaceElement.spaceId, { type: "element-removed", payload: { id } });

    return res.status(200).json({
      message: "Element removed from space successfully",
    });
  } catch (e) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
