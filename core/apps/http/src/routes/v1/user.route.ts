import { Router } from "express";
import {
  getAvatars,
  getBulkUserMetadata,
  signin,
  signup,
  updateUserMetadata,
} from "../../controllers/user.controller.js";
import { authenticateUser } from "../../middleware/userAuth.middleware.js";

export const userRouter = Router();

userRouter.post("/signup", signup);

userRouter.post("/signin", signin);

userRouter.get("/avatars", getAvatars);

userRouter.post("/metadata", authenticateUser, updateUserMetadata);

userRouter.get("/metadata/bulk", authenticateUser, getBulkUserMetadata);
