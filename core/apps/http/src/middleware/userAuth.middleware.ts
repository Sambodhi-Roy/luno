import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment variables");
  }
  return secret;
};

interface JwtPayload {
  userId: string;
}

export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token = req.cookies?.token;

  if(!token && req.headers.authorization)
  {
    const [type,value] = req.headers.authorization.split(" ");
    if(type === "Bearer")
    {
      token = value;
    }
  }

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized: No token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, getJWTSecret()) as JwtPayload;

    req.user = { id: decoded.userId };

    return next();
  } catch (err) {
    console.error("❌ JWT verification failed:", err);
    return res.status(403).json({
      message: "Forbidden: Invalid or expired token",
    });
  }
};
