import type { Request, Response } from "express";
import client from "@repo/db/client";
import {
  SignupSchema,
  SigninSchema,
  updateMetadataSchema,
} from "../types/index.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment variables");
  }
  return secret;
};

/* ===================== SIGNUP ===================== */
export const signup = async (req: Request, res: Response) => {
  const parsedData = SignupSchema.safeParse(req.body);

  if (!parsedData.success) {
    console.log("Parsed Data incorrect");
    return res.status(400).json({ message: "Validation failed" });
  }

  const { username, password, role } = parsedData.data;

  try {
    const existingUser = await client.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Username already taken",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let avatarToUse: string | null = null;
    const avatars = await client.avatar.findMany();

    if (avatars.length > 0) {
      avatarToUse = avatars[Math.floor(Math.random() * avatars.length)]?.id ?? null;
    } else {
      console.log("No avatar found in database, User will have no avatar yet");
    }

    const newUser = await client.user.create({
      data: {
        username,
        password: hashedPassword,
        role: role ?? "User",
        ...(avatarToUse && {
          avatar: { connect: { id: avatarToUse } },
        }),
      },
    });

    /* ✅ FIX: include role + consistent userId */
    const token = jwt.sign(
      {
        userId: newUser.id,
        role: newUser.role,
      },
      getJWTSecret(),
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        username: newUser.username,
        avatarId: newUser.avatarId,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ===================== SIGNIN ===================== */
export const signin = async (req: Request, res: Response) => {
  const parsedData = SigninSchema.safeParse(req.body);

  if (!parsedData.success) {
    console.log("Parsed Data incorrect");
    return res.status(400).json({ message: "Validation failed" });
  }

  const { username, password } = parsedData.data;

  try {
    const user = await client.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        message: "Incorrect password",
      });
    }

    /* ✅ FIX: include role + consistent userId */
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      getJWTSecret(),
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "User signed in successfully",
      token,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

/* ===================== AVATARS ===================== */
export const getAvatars = async (_req: Request, res: Response) => {
  try {
    const avatars = await client.avatar.findMany({
      select: {
        id: true,
        name: true,
        imageUrl: true,
      },
      orderBy: { name: "asc" },
    });

    if (avatars.length === 0) {
      return res.status(404).json({
        message: "No avatars found in database",
      });
    }

    return res.status(200).json({
      message: "Avatars fetched successfully",
      avatars,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

/* ===================== METADATA ===================== */
export const updateUserMetadata = async (req: Request, res: Response) => {
  const parsedData = updateMetadataSchema.safeParse(req.body);

  if (!parsedData.success) {
    return res.status(400).json({ message: "Validation failed" });
  }

  const { avatarId } = parsedData.data;
  const userId = req.user?.id;

  if (typeof userId !== "string") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const avatar = await client.avatar.findUnique({
      where: { id: avatarId },
    });

    if (!avatar) {
      return res.status(400).json({ message: "Avatar not found" });
    }

    await client.user.update({
      where: { id: userId },
      data: { avatarId },
    });

    return res.status(200).json({
      message: "User metadata updated successfully",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

/* ===================== BULK METADATA ===================== */
export const getBulkUserMetadata = async (req: Request, res: Response) => {
  const idsParam = req.query.ids as string | undefined;

  if (!idsParam) {
    return res.status(400).json({
      message: "Missing 'ids' query parameter",
    });
  }

  let userIds: string[];

  try {
    userIds = idsParam.startsWith("[")
      ? JSON.parse(idsParam)
      : idsParam.split(",");
  } catch {
    return res.status(400).json({
      message: "Incorrect 'ids' format error",
    });
  }

  if (userIds.length === 0) {
    return res.status(400).json({ message: "No user ids provided" });
  }

  try {
    const users = await client.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        avatar: { select: { imageUrl: true } },
      },
    });

    return res.status(200).json({
      avatars: users.map((u) => ({
        userId: u.id,
        imageUrl: u.avatar?.imageUrl ?? null,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
