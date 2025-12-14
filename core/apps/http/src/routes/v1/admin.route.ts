import { Router } from "express";
import { authenticateAdmin } from "../../middleware/adminAuth.middleware.js";
import { createAvatar, createElement, createMap, updateElement } from "../../controllers/admin.controller.js";

export const adminRouter = Router();

adminRouter.post("/element", authenticateAdmin, createElement);

adminRouter.put("/element/:elementId", authenticateAdmin, updateElement);

adminRouter.post("/avatar", authenticateAdmin, createAvatar);

adminRouter.post("/map", authenticateAdmin, createMap);
