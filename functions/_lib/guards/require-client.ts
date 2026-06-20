import type { Request, Response } from "express";
import { requireAuth } from "../auth";
import { isClientUser } from "../roles";
import { fail } from "../respond";

export async function requireClient(req: Request, res: Response) {
  const payload = await requireAuth(req, res);
  if (!payload) return null;

  const header = req.headers.authorization;
  const accessToken = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  if (!isClientUser(null, accessToken)) {
    fail(res, "Client access required", 403);
    return null;
  }

  return { payload, accessToken };
}
