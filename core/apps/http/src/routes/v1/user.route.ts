import { Router } from "express";
import {
  getAvatars,
  getBulkUserMetadata,
  getMe,
  signin,
  signout,
  signup,
  updateUserMetadata,
} from "../../controllers/user.controller.js";
import { authenticateUser } from "../../middleware/userAuth.middleware.js";

export const userRouter = Router();

userRouter.post("/signup", signup);

userRouter.post("/signin", signin);

userRouter.post("/signout", signout);

userRouter.get("/me", authenticateUser, getMe);

userRouter.get("/avatars", getAvatars);

userRouter.post("/metadata", authenticateUser, updateUserMetadata);

userRouter.get("/metadata/bulk", authenticateUser, getBulkUserMetadata);
