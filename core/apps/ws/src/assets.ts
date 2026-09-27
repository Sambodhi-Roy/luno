import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TiledMap } from "@repo/protocol";

// Map URLs like "/assets/maps/office.tmj" are served by apps/web from its public/ folder,
// so the server reads the same files from disk.
const defaultAssetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/public");
const assetsDir = path.resolve(process.env.ASSETS_DIR ?? defaultAssetsDir);

export async function loadTiledMap(url: string): Promise<TiledMap> {
  const file = path.resolve(assetsDir, "." + new URL(url, "http://assets").pathname);

  // Refuse anything that escapes the assets folder (e.g. "/../../.env")
  if (!file.startsWith(assetsDir + path.sep)) {
    throw new Error(`Map path is outside the assets folder: ${url}`);
  }

  return JSON.parse(await readFile(file, "utf8")) as TiledMap;
}
