import { Router } from "express";
import { SignupSchema } from "../../types/index.js";
import client from "@repo/db/client";
import { parse } from "zod";
import {
  getAvatars,
  getBulkUserMetadata,
  signin,
  signup,
  updateUserMetadata,
} from "../../controllers/user.controller.js";

export const userRouter = Router();

userRouter.post("/signup", signup);

userRouter.post("/signin", signin);

userRouter.get("/avatars", getAvatars);

userRouter.post("/metadata", updateUserMetadata);

userRouter.get("/metadata/bulk", getBulkUserMetadata);
