import type { Request, Response } from "express";
import client from "@repo/db/client";

export const getAllMaps = async (_req: Request, res: Response) => {
  try {
    const maps = await client.map.findMany({
      select: {
        id: true,
        name: true,
        width: true,
        height: true,
        thumbnail: true,
        tmjUrl: true,
      },
      orderBy: { name: "asc" },
    });

    return res.status(200).json({
      maps: maps.map((map) => ({
        id: map.id,
        name: map.name,
        dimensions: `${map.width}x${map.height}`,
        thumbnail: map.thumbnail,
        tmjUrl: map.tmjUrl ?? null,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
