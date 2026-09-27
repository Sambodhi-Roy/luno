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

/** Returns the user id from a token issued by apps/http, or null if it's missing, invalid or expired. */
export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJWTSecret()) as JwtPayload;
    return typeof decoded.userId === "string" ? decoded.userId : null;
  } catch {
    return null;
  }
}

/** Browsers can't read the httpOnly auth cookie, but they send it with the WebSocket upgrade request. */
export function tokenFromCookieHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "token") return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
