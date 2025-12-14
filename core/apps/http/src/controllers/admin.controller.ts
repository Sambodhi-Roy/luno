import type { Request, Response } from "express";
import client from "@repo/db/client";
import { createAvatarSchema, createElementSchema, createMapSchema, updateElementSchema } from "../types/index.js";
import { parse } from "dotenv";

export const createElement = async(req:Request, res: Response) => {
    const parsed = createElementSchema.safeParse(req.body)

    if(!parsed.success){
        return res.status(400).json({
            message: "Validation failed",
            errors: parsed.error
        })
    }

    const {imageUrl, width, height, static: isStatic} = parsed.data

    try{
        const element = await client.element.create({
            data:{
                imageUrl,
                width,
                height,
                static: isStatic
            }
        })

        return res.status(200).json({
            id: element.id
        })
    }
    catch(e)
    {
        return res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

export const updateElement = async(req: Request, res: Response)=>{
    const {elementId} = req.params

    if(!elementId){
        return res.status(400).json({
            message: "elementId required"
        })
    }

    const parsed = updateElementSchema.safeParse(req.body)
    if(!parsed.success){
        return res.status(400).json({
            message: "Validation failed",
            errors: parsed.error
        })
    }

    try{
        await client.element.update({
            where: {id: elementId},
            data:{
                imageUrl: parsed.data.imageUrl
            }
        })

        return res.status(200).json({
            message: "Element updated"
        })
    }
    catch(e)
    {
        return res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

export const createAvatar = async(req: Request, res: Response) => {
    const parsed = createAvatarSchema.safeParse(req.body)

    if(!parsed.success){
        return res.status(400).json({
            message: "Validation failed",
            errors: parsed.error
        })
    }

    try{
        const avatar = await client.avatar.create({
            data:{
                name: parsed.data.name,
                imageUrl: parsed.data.imageUrl
            }
        })

        return res.status(200).json({
            avatarId: avatar.id
        })
    }
    catch(e)
    {
        return res.status(500).json({
            message: "Internal Server error"
        })
    }
}

export const createMap = async (req: Request, res: Response) => {
  const parsed = createMapSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error,
    });
  }

  const { thumbnail, dimensions, defaultElements, name } = parsed.data;

  const [widthStr, heightStr] = dimensions.split("x") as [string, string];
  const width = parseInt(widthStr, 10);
  const height = parseInt(heightStr, 10);

  try {
    const map = await client.$transaction(async (tx) => {
      const createdMap = await tx.map.create({
        data: {
          name,
          width,
          height,
          thumbnail,
        },
      });

      if (defaultElements.length > 0) {
        await tx.mapElements.createMany({
          data: defaultElements.map((el) => ({
            mapId: createdMap.id,
            elementId: el.elementId,
            x: el.x,
            y: el.y,
          })),
        });
      }

      return createdMap; 
    });

    return res.status(200).json({
      id: map.id,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
