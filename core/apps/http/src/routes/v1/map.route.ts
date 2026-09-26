import { Router } from "express";
import { getAllMaps } from "../../controllers/map.controller.js";
import { authenticateUser } from "../../middleware/userAuth.middleware.js";

export const mapRouter = Router();

mapRouter.get("/", authenticateUser, getAllMaps);
