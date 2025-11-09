import { Router } from "express";
import { createSpace } from "../../controllers/space.controller.js";

export const spaceRouter = Router();

spaceRouter.post("/", createSpace);

spaceRouter.get("/all", (req, res) => {});

spaceRouter.get("/:spaceId", (req, res) => {});

spaceRouter.delete("/:spaceId", (req, res) => {});

spaceRouter.get("/elements", (req, res) => {});

spaceRouter.post("/element", (req, res) => {});

spaceRouter.delete("/element", (req, res) => {});
