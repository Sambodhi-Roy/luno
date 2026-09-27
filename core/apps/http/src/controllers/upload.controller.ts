import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { isPng, safeFileName, saveUpload } from "../lib/uploads.js";
import { tiledMapSchema, uploadImageSchema } from "../types/index.js";

// The game draws 32px tiles; maps with other tile sizes would render misaligned
const TILE_SIZE = 32;

export const uploadImage = async (req: Request, res: Response) => {
  const parsed = uploadImageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "kind must be element, avatar or thumbnail" });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: "A file field is required" });
  }
  if (!isPng(file.buffer)) {
    return res.status(400).json({ message: "Only PNG images are accepted" });
  }

  try {
    const url = await saveUpload(`${parsed.data.kind}s/${randomUUID()}.png`, file.buffer);
    return res.status(200).json({ url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const uploadMap = async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[] | undefined> | undefined;
  const mapFile = files?.map?.[0];
  const tilesetFiles = files?.tilesets ?? [];

  if (!mapFile) {
    return res.status(400).json({ message: "A map field with the .tmj file is required" });
  }

  let json: unknown;
  try {
    json = JSON.parse(mapFile.buffer.toString("utf8"));
  } catch {
    return res.status(400).json({ message: "The map file isn't valid JSON (export it from Tiled as .tmj)" });
  }

  const parsed = tiledMapSchema.safeParse(json);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Not a supported Tiled map: it needs width, height, layers and embedded tilesets with images",
    });
  }

  const map = parsed.data;
  if (map.tilewidth !== TILE_SIZE || map.tileheight !== TILE_SIZE) {
    return res.status(400).json({ message: `Tiles must be ${TILE_SIZE}x${TILE_SIZE} pixels` });
  }

  // Each tileset image is found by file name next to the .tmj, so every one must be uploaded
  const uploaded = new Map(tilesetFiles.map((f) => [safeFileName(f.originalname), f]));
  const needed = [...new Set(map.tilesets.map((ts) => safeFileName(ts.image)))];
  const missing = needed.filter((name) => !uploaded.has(name));
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing tileset images: ${missing.join(", ")}` });
  }
  if (tilesetFiles.some((f) => !isPng(f.buffer))) {
    return res.status(400).json({ message: "Tileset images must be PNG" });
  }

  try {
    const folder = `maps/${randomUUID()}`;
    for (const name of needed) {
      await saveUpload(`${folder}/${name}`, uploaded.get(name)!.buffer);
    }
    const tmjUrl = await saveUpload(`${folder}/map.tmj`, mapFile.buffer);

    return res.status(200).json({ tmjUrl, width: map.width, height: map.height });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
