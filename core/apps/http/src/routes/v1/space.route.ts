import { Router } from "express";
import { addElementToSpace, createSpace, deleteSpace, getAllElements, getAllSpaces, getSpace, removeElementFromSpace } from "../../controllers/space.controller.js";
import { authenticateUser } from "../../middleware/userAuth.middleware.js";

export const spaceRouter = Router();

spaceRouter.post("/", authenticateUser, createSpace);

spaceRouter.get("/all", authenticateUser, getAllSpaces);

spaceRouter.get("/:spaceId", authenticateUser ,getSpace);

spaceRouter.delete("/:spaceId", authenticateUser ,deleteSpace);

spaceRouter.get("/elements", getAllElements);

spaceRouter.post("/element", authenticateUser, addElementToSpace);

spaceRouter.delete("/element", authenticateUser, removeElementFromSpace);
