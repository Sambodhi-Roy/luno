import { Router } from "express";
import { userRouter } from "./user.js";
import { spaceRouter } from "./space.js";
import { adminRouter } from "./admin.js";
import { SignupSchema } from "../../types/index.js";
import { parse } from "zod";

export const router = Router();

router.post("/signup", async (req, res) => {
  const parsedData = SignupSchema.safeParse(req.body);
  if (!parsedData.success) {
    return res.status(400).json({
      message: "Validation failed",
    });
  }
  res.json({
    message: "Signup route",
  });
});

router.post("/signin", (req, res) => {
  res.json({
    message: "Login route",
  });
});

router.get("/elements", (req, res) => {});

router.get("/avatars", (req, res) => {});

router.use("/user", userRouter);
router.use("/space", spaceRouter);
router.use("/admin", adminRouter);
