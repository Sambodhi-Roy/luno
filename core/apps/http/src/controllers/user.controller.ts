import type { Request, Response } from "express";
import client from "@repo/db/client";
import { SignupSchema } from "../types/index.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

if (!process.env.JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment variables");
}

const JWT_SECRET = process.env.JWT_SECRET;

export const signup = async (req: Request, res: Response) => {
  const parsedData = SignupSchema.safeParse(req.body);
  if (!parsedData.success) {
    console.log("Parsed Data incorrect");
    res.status(400).json({
      message: "Validation failed",
    });
    return;
  }

  const { username, password } = parsedData.data;

  try {
    const existingUser = await client.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      res.status(409).json({
        message: "Username already taken",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let avatarToUse;

    const avatars = await client.avatar.findMany();
    if (avatars.length > 0) {
      const randomIndex = Math.floor(Math.random() * avatars.length);
      avatarToUse = avatars[randomIndex].id;
    } else {
      console.log("No user found in database, User will have no avatar yet");
      avatarToUse = null;
    }

    // Adding the new User to the database
    const newUser = await client.user.create({
      data: {
        username: username,
        password: hashedPassword,
        avatarId: avatarToUse ?? undefined,
        role: "User",
      },
    });

    // Generating JWT token
    const token = jwt.sign({ userid: newUser.id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        username: newUser.username,
        avatarId: newUser.avatarId,
      },
    });
  } catch (e) {
    console.log("Error detected: ", e);
    res.status(500).json({ message: "Internal server error" });
  }
};
