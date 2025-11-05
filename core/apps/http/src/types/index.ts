import { z } from "zod";

export const SignupSchema = z.object({
  username: z.string(),
  password: z.string().min(8),
});

export const SigninSchema = z.object({
  username: z.string(),
  password: z.string().min(8),
});

export const updateMetadataSchema = z.object({
  avatarId: z.string(),
});

export const createSpaceSchema = z.object({
  name: z.string().min(3).max(30),
  // Custom function to validate the dimensions
  dimensions: z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
  mapId: z.string(),
});

export const addElementSchema = z.object({
  spaceId: z.string(),
  elementId: z.string(),
  x: z.number(),
  y: z.number(),
});

export const createElementSchema = z.object({
  imageUrl: z.string(),
  width: z.number(),
  height: z.number(),
  static: z.boolean(),
});

export const updateElementSchema = z.object({
  imageUrl: z.string(),
});

export const createAvatarSchema = z.object({
  name: z.string(),
  imageUrl: z.string(),
});

export const createMapSchema = z.object({
  thumbnail: z.string(),
  dimensions: z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
  defaultElements: z.array(
    z.object({
      elementOd: z.string(),
      x: z.number(),
      y: z.number(),
    })
  ),
});
