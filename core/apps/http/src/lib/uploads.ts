import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";

// Uploads are written into apps/web/public/uploads, so the web app serves them at /uploads/...
// (local disk for now; cloud storage comes with deployment).
const defaultUploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../web/public/uploads");
export const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR ?? defaultUploadsDir);
export const UPLOADS_URL = "/uploads";

const MB = 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * MB;
export const MAX_MAP_FILE_BYTES = 5 * MB;
export const MAX_TILESETS = 10;

// Every PNG starts with these 8 bytes; checking them beats trusting the file name or declared type
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const isPng = (buffer: Buffer) => buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);

/** A file name safe to write: no folders, only letters, digits, dot, dash and underscore. */
export const safeFileName = (name: string) => path.basename(name).replace(/[^\w.-]/g, "_");

/** Writes a file under UPLOADS_DIR and returns its public URL. */
export async function saveUpload(relativePath: string, data: Buffer | string) {
  const file = path.join(UPLOADS_DIR, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return `${UPLOADS_URL}/${relativePath.split(path.sep).join("/")}`;
}

/**
 * Runs a multer (in-memory) middleware and turns its errors (too large, too many files, unexpected field)
 * into 400 responses instead of 500s.
 */
export function receiveFiles(middleware: ReturnType<ReturnType<typeof multer>["single"]>) {
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Upload rejected: ${err.message}` });
      }
      if (err) return next(err);
      next();
    });
  };
}
