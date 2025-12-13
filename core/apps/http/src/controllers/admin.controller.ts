import type { Request, Response } from "express";
import client from "@repo/db/client";
import { createElementSchema, updateElementSchema } from "../types/index.js";
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