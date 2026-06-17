import type { Request, Response } from "express";
import { z } from "zod";
import {
  NhostAuthError,
  signInWithEmailPassword,
  signOutWithRefreshToken,
} from "../_lib/nhost-auth";
import { isAdminUser } from "../_lib/roles";
import { ok, fail } from "../_lib/respond";
import { validate } from "../_lib/validate";

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default async function signIn(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = validate(req, res, SignInSchema);
    if (!body) return;

    const session = await signInWithEmailPassword(body.email, body.password);

    if (!isAdminUser(session.user, session.accessToken)) {
      try {
        await signOutWithRefreshToken(session.refreshToken);
      } catch {
        // Best-effort revoke for rejected non-admin sessions.
      }
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
      const status = error.status === 401 ? 401 : error.status;
      fail(res, error.message, status);
      return;
    }

    console.error("[auth/sign-in]", error);
    fail(res, "Internal server error", 500);
  }
}
