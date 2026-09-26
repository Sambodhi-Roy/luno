import { Router } from "express";
import { userRouter } from "./user.route.js";
import { spaceRouter } from "./space.route.js";
import { adminRouter } from "./admin.route.js";
import { mapRouter } from "./map.route.js";

export const router = Router();

router.use("/user", userRouter);
router.use("/space", spaceRouter);
router.use("/admin", adminRouter);
router.use("/maps", mapRouter);
