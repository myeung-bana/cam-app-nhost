import type { Request, Response } from "express";
import { z } from "zod";
import { NhostAuthError, refreshAuthSession } from "../_lib/nhost-auth";
import { isAdminUser } from "../_lib/roles";
import { ok, fail } from "../_lib/respond";
import { validate } from "../_lib/validate";

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export default async function refresh(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = validate(req, res, RefreshSchema);
    if (!body) return;

    const session = await refreshAuthSession(body.refreshToken);

    if (!isAdminUser(session.user, session.accessToken)) {
      fail(res, "Admin access required", 403);
      return;
    }

    ok(res, {
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        defaultRole: session.user.defaultRole,
      },
      accessToken: session.accessToken,
      accessTokenExpiresIn: session.accessTokenExpiresIn,
      refreshToken: session.refreshToken,
    });
  } catch (error) {
    if (error instanceof NhostAuthError) {
      fail(res, error.message, error.status === 401 ? 401 : error.status);
      return;
    }

    console.error("[auth/refresh]", error);
    fail(res, "Internal server error", 500);
  }
}
