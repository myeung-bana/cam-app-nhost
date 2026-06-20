import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env";
import { fail } from "./respond";

export interface JwtPayload {
  sub?: string;
  "https://hasura.io/jwt/claims"?: {
    "x-hasura-default-role"?: string;
    "x-hasura-allowed-roles"?: string[];
    "x-hasura-user-id"?: string;
    [key: string]: string | string[] | undefined;
  };
}

export async function requireAuth(
  req: Request,
  res: Response
): Promise<JwtPayload | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    fail(res, "Unauthorized", 401);
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    fail(res, "Unauthorized", 401);
    return null;
  }

  try {
    const payload = jwt.verify(token, env.jwtPublicKey, {
      algorithms: ["RS256"],
    }) as JwtPayload;
    return payload;
  } catch {
    fail(res, "Unauthorized", 401);
    return null;
  }
}

export function getUserId(payload: JwtPayload): string | null {
  return (
    payload["https://hasura.io/jwt/claims"]?.["x-hasura-user-id"] ??
    payload.sub ??
    null
  );
}
