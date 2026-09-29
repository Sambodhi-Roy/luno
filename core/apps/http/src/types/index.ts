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

// Public spaces are listed in Explore and open to everyone signed in; private ones need an invite link
const visibilitySchema = z.enum(["Public", "Private"]);

export const createSpaceSchema = z
  .object({
    name: z.string().min(3).max(30),
    // "<width>x<height>" in tiles; defaults to the map's size when mapId is given
    dimensions: z.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/).optional(),
    mapId: z.string().optional(),
    visibility: visibilitySchema.default("Private"),
  })
  .refine((data) => data.dimensions || data.mapId, {
    message: "Either dimensions or mapId is required",
  });

export const updateSpaceSchema = z
  .object({
    name: z.string().min(3).max(30).optional(),
    visibility: visibilitySchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.visibility !== undefined, {
    message: "Nothing to update",
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
export const uploadImageSchema = z.object({
  kind: z.enum(["element", "avatar", "thumbnail"]),
});

// The parts of a Tiled .tmj export the game relies on. Tilesets must be embedded (not external .tsx files).
export const tiledMapSchema = z.object({
  type: z.literal("map"),
  width: z.number().int().positive().max(9999),
  height: z.number().int().positive().max(9999),
  tilewidth: z.number().int().positive(),
  tileheight: z.number().int().positive(),
  layers: z.array(z.object({ type: z.string() })).min(1),
  tilesets: z.array(z.object({ firstgid: z.number().int(), image: z.string().min(1) })).min(1),
});
