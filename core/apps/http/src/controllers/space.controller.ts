import type { Request, Response } from "express";
import client from "@repo/db/client";
import { createSpaceSchema, addElementSchema } from "../types/index.js";
import { parse } from "dotenv";
import { Prisma } from "@repo/db/client";

export const createSpace = async (req: Request, res: Response) => {
  const parsedData = createSpaceSchema.safeParse(req.body);

  if (!parsedData.success) {
    return res.status(400).json({
      message: "Validation failed",
    });
  }

  const { name, dimensions, mapId } = parsedData.data;

  const [widthStr, heightStr] = dimensions.split("x") as [string, string];
  const width = parseInt(widthStr, 10);
  const height = parseInt(heightStr, 10);

  const creatorId = req.user?.id;

  if (!creatorId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
  try {
    const space = await client.space.create({
      data: {
        name,
        width,
        height,
        creatorId,
        ...(mapId && { mapId }),
      },
    });

    return res.status(200).json({
      message: "Space created successfully",
    });
  } catch (e) {
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
    const spaces: Prisma.SpaceGetPayload<{
      select: {
        id: true;
        name: true;
        width: true;
        height: true;
        thumbnail: true;
      };
    }>[] = await client.space.findMany({
      where: { creatorId },
      select: {
        id: true,
        name: true,
        width: true,
        height: true,
        thumbnail: true,
      },
    });

    const formattedSpaces = spaces.map((space) => ({
      id: space.id,
      name: space.name,
      dimensions: `${space.width}x${space.height}`,
      thumbnail: space.thumbnail ?? null,
    }));

    return res.status(200).json({ spaces: formattedSpaces });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Error fetching spaces, Internal server error" });
  }
};

export const getSpace = async (req: Request, res: Response) => {
  const creatorId = req.user?.id;
  const spaceId = req.params;

  if (!creatorId) {
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
    const space = await client.space.findFirst({
      where: {
        id: spaceId,
        creatorId,
      },
      include: {
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

    const dimensions = `${space.width}x${space.height ?? 0}`;

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
      dimensions,
      elements,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const deleteSpace = async (req: Request, res: Response) => {
  const creatorId = req.user?.id;
  const { spaceId } = req.params;

  if (!creatorId) {
    return res.status(401).json({
      messgae: "Unauthorised",
    });
  }

  if (!spaceId) {
    return res.status(400).json({
      message: "SpaceId param is required",
    });
  }

  try {
    const space = await client.space.findFirst({
      where: {
        id: spaceId,
        creatorId,
      },
      include: {
        elements: true,
      },
    });

    if (!space) {
      return res.status(404).json({
        message: "SpaceId not found, Invalid SpaceId",
      });
    }

    await client.spaceElements.deleteMany({
      where: { spaceId },
    });

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
