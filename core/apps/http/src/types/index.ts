import { z } from "zod";

export const SignupSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(8),
  role: z.enum(["User", "Admin"]).optional(),
});

export const SigninSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(8),
});

export const updateMetadataSchema = z.object({
  avatarId: z.string(),
});

export const createSpaceSchema = z
  .object({
    name: z.string().min(3).max(30),
    // "<width>x<height>" in tiles; defaults to the map's size when mapId is given
    dimensions: z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/).optional(),
    mapId: z.string().optional(),
  })
  .refine((data) => data.dimensions || data.mapId, {
    message: "Either dimensions or mapId is required",
  });

export const addElementSchema = z.object({
  spaceId: z.string(),
  elementId: z.string(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
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
  name: z.string().min(3),
  thumbnail: z.string(),
  tmjUrl: z.string().optional(),
  dimensions: z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
  defaultElements: z.array(
    z.object({
      elementId: z.string(),
      x: z.number(),
      y: z.number(),
    })
  ),
});

export const deleteElementSchema = z.object({
  id: z.string()
}) 