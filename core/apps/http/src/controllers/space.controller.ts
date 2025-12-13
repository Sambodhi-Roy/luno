import type { Request, Response } from "express";
import client from "@repo/db/client";
import { createSpaceSchema, addElementSchema, deleteElementSchema } from "../types/index.js";
import { parse } from "dotenv";
import { Prisma } from "@repo/db/client";

export const createSpace = async (req: Request, res: Response) => {
  const parsedData = createSpaceSchema.safeParse(req.body);

  if (!parsedData.success) {
    return res.status(400).json({
      message: "Validation failed",
    });
  }

  const { name, dimensions, mapId } = parsedData.data;

  const [widthStr, heightStr] = dimensions.split("x") as [string, string];
  const width = parseInt(widthStr, 10);
  const height = parseInt(heightStr, 10);

  const creatorId = req.user?.id;

  if (!creatorId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
  try {
    const space = await client.space.create({
      data: {
        name,
        width,
        height,
        creatorId,
        ...(mapId && { mapId }),
      },
    });

    return res.status(200).json({
      message: "Space created successfully",
    });
  } catch (e) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getAllSpaces = async (req: Request, res: Response) => {
  const creatorId = req.user?.id;

  if (!creatorId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const spaces: Prisma.SpaceGetPayload<{
      select: {
        id: true;
        name: true;
        width: true;
        height: true;
        thumbnail: true;
      };
    }>[] = await client.space.findMany({
      where: { creatorId },
      select: {
        id: true,
        name: true,
        width: true,
        height: true,
        thumbnail: true,
      },
    });

    const formattedSpaces = spaces.map((space) => ({
      id: space.id,
      name: space.name,
      dimensions: `${space.width}x${space.height}`,
      thumbnail: space.thumbnail ?? null,
    }));

    return res.status(200).json({ spaces: formattedSpaces });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Error fetching spaces, Internal server error" });
  }
};

export const getSpace = async (req: Request, res: Response) => {
  const creatorId = req.user?.id;
  const spaceId = req.params;

  if (!creatorId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (!spaceId) {
    return res.status(400).json({
      message: "SpaceId param required",
    });
  }

  try {
    const space = await client.space.findFirst({
      where: {
        id: spaceId,
        creatorId,
      },
      include: {
        elements: {
          include: {
            element: true,
          },
        },
      },
    });

    if (!space) {
      return res.status(404).json({
        message: "Space not found",
      });
    }

    const dimensions = `${space.width}x${space.height ?? 0}`;

    const elements = space.elements.map((se) => ({
      id: se.id,
      element: {
        id: se.element.id,
        imageUrl: se.element.imageUrl,
        height: se.element.height,
        width: se.element.width,
        static: se.element.static,
      },
      x: se.x,
      y: se.y,
    }));

    return res.status(200).json({
      dimensions,
      elements,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const deleteSpace = async (req: Request, res: Response) => {
  const creatorId = req.user?.id;
  const { spaceId } = req.params;

  if (!creatorId) {
    return res.status(401).json({
      messgae: "Unauthorised",
    });
  }

  if (!spaceId) {
    return res.status(400).json({
      message: "SpaceId param is required",
    });
  }

  try {
    const space = await client.space.findFirst({
      where: {
        id: spaceId,
        creatorId,
      },
      include: {
        elements: true,
      },
    });

    if (!space) {
      return res.status(404).json({
        message: "SpaceId not found, Invalid SpaceId",
      });
    }

    await client.spaceElements.deleteMany({
      where: { spaceId },
    });

    await client.space.delete({
      where: { id: spaceId },
    });

    return res.status(200).json({
      message: "Space deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getAllElements = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({
      message: "Unauthorised",
    });
  }

  try {
    const elements = await client.element.findMany({
      select: {
        id: true,
        imageUrl: true,
        width: true,
        height: true,
        static: true,
      },
    });

    return res.status(200).json({
      elements,
    });
  } catch (e) {
    console.log("Error fetching elements");
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const addElementToSpace = async (req:Request, res:Response) => {
  const userId = req.user?.id
  if(!userId)
  {
    return res.status(401).json({
      message: "Unauthorised"
    })
  }

  const parsed = addElementSchema.safeParse(req.body)
  if(!parsed.success)
  {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error
    })
  }

  const {spaceId, elementId, x, y} = parsed.data;

  try{
    const space = await client.space.findFirst({
      where: {
        id: spaceId,
        creatorId: userId
      }
    });

    if(!space){
      return res.status(400).json({
        message: "Invalid spaceId or access denied"
      })
    }

    const element = await client.element.findUnique({
      where: {
        id: elementId,
      }
    })

    if(!element)
    {
      return res.status(400).json({
        message: "Invalid elementId"
      })
    }

    const spaceElement = await client.spaceElements.create({
      data:{
        spaceId,
        elementId,
        x,
        y,
      }
    })

    return res.status(200).json({
      message: "Element added to space successfully",
      element:{
        id: spaceElement.id,
        elementId,
        x,
        y
      }
    })
  }
  catch(e)
  {
    return res.status(500).json({
      message: "Internal Server Error"
    })
  }
}

export const removeElementFromSpace = async(req:Request, res:Response)=>{
  const userId = req.user?.id
  if(!userId){
    return res.status(401).json({
      message: "Unauthorized"
    })
  }

  const parsed = deleteElementSchema.safeParse(req.body)

  if(!parsed.success)
  {
    return res.status(400).json({
      message: "spaceElement id is required"
    })
  }

  try{
    const {id} = parsed.data;

    const spaceElement = await client.spaceElements.findFirst({
      where: {id},
      include:{
        space: true,
      }
    })

    if(!spaceElement){
      return res.status(400).json({
        message: "Invalid element id"
      })
    }

    if(spaceElement.space.creatorId !== userId){
      return res.status(400).json({
        message: "You do not have permission to modify this space",
      })
    }

    await client.spaceElements.delete({
      where: {
        id
      }
    })

    return res.status(200).json({
      message: "Element removed from space successfully"
    })
  }
  catch(e)
  {
    return res.status(500).json({
      message: "Internal Server Error"
    })
  }
}