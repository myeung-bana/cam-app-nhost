import type { Request, Response } from "express";
import { requireAdmin } from "../../_lib/guards/require-admin";
import { ok, fail } from "../../_lib/respond";
import { getUserId } from "../../_lib/auth";

export default async function session(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const auth = await requireAdmin(req, res);
    if (!auth) return;

    const userId = getUserId(auth);
    if (!userId) {
      fail(res, "Unauthorized", 401);
      return;
    }

    const claims = auth["https://hasura.io/jwt/claims"];

    ok(res, {
      user: {
        id: userId,
        defaultRole: claims?.["x-hasura-default-role"],
      },
      accessToken: auth.accessToken,
    });
  } catch (error) {
    console.error("[admin/auth/session]", error);
    fail(res, "Internal server error", 500);
  }
}
