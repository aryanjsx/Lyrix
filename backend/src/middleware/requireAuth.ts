import { Request, Response, NextFunction } from "express";
import { verifyJWT } from "../services/authService";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.lyrix_token as string | undefined;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = verifyJWT(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.clearCookie("lyrix_token", { path: "/" });
    res.status(401).json({ error: "Session expired" });
  }
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (token) {
    try {
      const payload = verifyJWT(token);
      req.userId = payload.userId;
    } catch {
      // invalid token — proceed as guest
    }
  }
  next();
}
