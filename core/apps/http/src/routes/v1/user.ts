import { Router } from "express";

export const userRouter = Router();

userRouter.post("/signup", (req, res) => {});

userRouter.post("/signin", (req, res) => {});

userRouter.get("/avatars", (req, res) => {});

userRouter.post("/metadata", (req, res) => {});

userRouter.get("/metadata/bulk", (req, res) => {});
