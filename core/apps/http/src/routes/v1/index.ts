import { Router } from "express";
import { userRouter } from "./user.js";
import { spaceRouter } from "./space.js";
import { adminRouter } from "./admin.js";
import { SignupSchema } from "../../types/index.js";
import { parse } from "zod";

export const router = Router();

router.use("/user", userRouter);
router.use("/space", spaceRouter);
router.use("/admin", adminRouter);
