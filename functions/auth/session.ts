import type { Request, Response } from "express";
import { requireAuth } from "../_lib/auth";
import { isAdminUser } from "../_lib/roles";
import { ok, fail } from "../_lib/respond";

export default async function session(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const payload = await requireAuth(req, res);
    if (!payload) return;

    const header = req.headers.authorization;
    const accessToken = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : "";

    if (!isAdminUser(null, accessToken)) {
      fail(res, "Admin access required", 403);
      return;
    }

    const claims = payload["https://hasura.io/jwt/claims"];
    const userId = claims?.["x-hasura-user-id"] ?? payload.sub;

    if (!userId) {
      fail(res, "Unauthorized", 401);
      return;
    }

    ok(res, {
      user: {
        id: userId,
        defaultRole: claims?.["x-hasura-default-role"],
      },
      accessToken,
    });
  } catch (error) {
    console.error("[auth/session]", error);
    fail(res, "Internal server error", 500);
  }
}
