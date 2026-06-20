import type { Request, Response } from "express";
import { requireAuth, getUserId, type JwtPayload } from "../auth";
import { isAdminUser } from "../roles";
import { fail } from "../respond";

export async function requireAdmin(
  req: Request,
  res: Response
): Promise<(JwtPayload & { accessToken: string }) | null> {
  const payload = await requireAuth(req, res);
  if (!payload) return null;

  const header = req.headers.authorization;
  const accessToken = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  if (!isAdminUser(null, accessToken)) {
    fail(res, "Admin access required", 403);
    return null;
  }

  if (!getUserId(payload)) {
    fail(res, "Unauthorized", 401);
    return null;
  }

  return { ...payload, accessToken };
}
