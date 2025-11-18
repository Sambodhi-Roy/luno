import { Router } from "express";
import { createSpace } from "../../controllers/space.controller.js";
import { authenticateUser } from "../../middleware/userAuth.middleware.js";

export const spaceRouter = Router();

spaceRouter.post("/", authenticateUser, createSpace);

spaceRouter.get("/all", (req, res) => {});

spaceRouter.get("/:spaceId", (req, res) => {});

spaceRouter.delete("/:spaceId", (req, res) => {});

spaceRouter.get("/elements", (req, res) => {});

spaceRouter.post("/element", (req, res) => {});

spaceRouter.delete("/element", (req, res) => {});
