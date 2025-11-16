import type { Request, Response } from "express";
import client from "@repo/db/client";
import { createSpaceSchema, addElementSchema } from "../types/index.js";
import { parse } from "dotenv";

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
