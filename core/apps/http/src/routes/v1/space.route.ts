import { Router } from "express";
import {
  addElementToSpace,
  createSpace,
  deleteSpace,
  getAllElements,
  getAllSpaces,
  getSpace,
  removeElementFromSpace,
  resetInviteCode,
  updateSpace,
} from "../../controllers/space.controller.js";
import {
  acceptInvite,
  getInvite,
  getJoinedSpaces,
  getPublicSpaces,
  leaveSpace,
  visitSpace,
} from "../../controllers/membership.controller.js";
import { authenticateUser } from "../../middleware/userAuth.middleware.js";

export const spaceRouter = Router();

spaceRouter.post("/", authenticateUser, createSpace);

// Static paths must be registered before "/:spaceId", otherwise e.g. "element" is captured as a spaceId
spaceRouter.get("/all", authenticateUser, getAllSpaces);

spaceRouter.get("/joined", authenticateUser, getJoinedSpaces);

spaceRouter.get("/public", authenticateUser, getPublicSpaces);

spaceRouter.get("/elements", authenticateUser, getAllElements);

spaceRouter.post("/element", authenticateUser, addElementToSpace);

spaceRouter.delete("/element", authenticateUser, removeElementFromSpace);

spaceRouter.get("/invite/:code", authenticateUser, getInvite);

spaceRouter.post("/invite/:code", authenticateUser, acceptInvite);

spaceRouter.get("/:spaceId", authenticateUser, getSpace);

spaceRouter.patch("/:spaceId", authenticateUser, updateSpace);

spaceRouter.delete("/:spaceId", authenticateUser, deleteSpace);

spaceRouter.post("/:spaceId/visit", authenticateUser, visitSpace);

spaceRouter.post("/:spaceId/invite/reset", authenticateUser, resetInviteCode);

spaceRouter.delete("/:spaceId/membership", authenticateUser, leaveSpace);
