import type { Request, Response } from "express";
import { requireAuth, getUserId, type JwtPayload } from "../auth";
import { isAdminUser } from "../roles";
import { env } from "../env";
import { fail } from "../respond";

export interface AdminAccess {
  mode: "jwt" | "server";
  userId: string | null;
  accessToken?: string;
  payload?: JwtPayload;
}

const ADMIN_SECRET_HEADER = "x-hasura-admin-secret";
const ACTING_ADMIN_HEADER = "x-memo-admin-user-id";

function readHeader(req: Request, name: string): string | null {
  const value = req.headers[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

/**
 * Admin route auth — trusted server (Hasura admin secret) OR verified admin JWT.
 * Use for all /admin/* control-plane routes except auth entrypoints and session probe.
 */
export async function requireAdminAccess(
  req: Request,
  res: Response
): Promise<AdminAccess | null> {
  const serverSecret = readHeader(req, ADMIN_SECRET_HEADER);
  if (serverSecret && serverSecret === env.adminSecret) {
    return {
      mode: "server",
      userId: readHeader(req, ACTING_ADMIN_HEADER),
    };
  }

  const payload = await requireAuth(req, res);
  if (!payload) return null;

  const authHeader = readHeader(req, "authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "") ?? "";

  if (!isAdminUser(null, accessToken)) {
    fail(res, "Admin access required", 403);
    return null;
  }

  const userId = getUserId(payload);
  if (!userId) {
    fail(res, "Unauthorized", 401);
    return null;
  }

  return { mode: "jwt", userId, accessToken, payload };
}
