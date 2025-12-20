import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken"
import client from "@repo/db/client";

const getJWTSecret = () => {
    const secret = process.env.JWT_SECRET;
    if(!secret){
        throw new Error("Missing JWT_SECRET in environment variables")        
    }

    return secret
}

interface JwtPayload{
    userId: string
}

export const authenticateAdmin = async(req: Request, res: Response, next: NextFunction) => {
    let token = req.cookies?.token

    if(!token && req.headers.authorization)
    {
        const [type,value] = req.headers.authorization.split(" ")
        if(type==="Bearer")
        {
            token = value;
        }
    }

    if(!token){
        return res.status(401).json({
            message: "Unauthorised"
        })
    }

    try{
        const decoded = jwt.verify(token, getJWTSecret()) as JwtPayload

        const user = await client.user.findUnique({
            where: {id:decoded.userId},
            select: {role: true}
        })

        if(!user || user.role !== "Admin")
        {
            return res.status(403).json({
                message: "Forbidden"
            })
        }

        req.user = {id: decoded.userId}
        next()
    }
    catch(e)
    {
        return res.status(403).json({
            message: "Forbidden"
        })
    }
}