import { Router } from "express";
import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import multer from "multer";
import { createAvatar, createElement, createMap, updateElement } from "../../controllers/admin.controller.js";
import { uploadImage, uploadMap } from "../../controllers/upload.controller.js";
import { MAX_IMAGE_BYTES, MAX_MAP_FILE_BYTES, MAX_TILESETS, receiveFiles } from "../../lib/uploads.js";

export const adminRouter = Router();

adminRouter.post("/element", authenticateAdmin, createElement);

adminRouter.put("/element/:elementId", authenticateAdmin, updateElement);

adminRouter.post("/avatar", authenticateAdmin, createAvatar);

adminRouter.post("/map", authenticateAdmin, createMap);

// Files are held in memory, validated, then written to the uploads folder by the controller
adminRouter.post(
  "/upload/image",
  authenticateAdmin,
  receiveFiles(multer({ limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }).single("file")),
  uploadImage
);

adminRouter.post(
  "/upload/map",
  authenticateAdmin,
  receiveFiles(
    multer({ limits: { fileSize: MAX_MAP_FILE_BYTES, files: MAX_TILESETS + 1 } }).fields([
      { name: "map", maxCount: 1 },
      { name: "tilesets", maxCount: MAX_TILESETS },
    ])
  ),
  uploadMap
);
