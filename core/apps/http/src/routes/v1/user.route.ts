import { Router } from "express";
import { SignupSchema } from "../../types/index.js";
import client from "@repo/db/client";
import { parse } from "zod";
import {
  getAvatars,
  signin,
  signup,
} from "../../controllers/user.controller.js";

export const userRouter = Router();

userRouter.post("/signup", signup);

userRouter.post("/signin", signin);

userRouter.get("/avatars", getAvatars);

userRouter.post("/metadata", (req, res) => {});

userRouter.get("/metadata/bulk", (req, res) => {});
