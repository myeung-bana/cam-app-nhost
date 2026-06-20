import type { Request, Response } from "express";
import { z } from "zod";
import { NhostAuthError, signOutWithRefreshToken } from "../../_lib/nhost-auth";
import { ok, fail } from "../../_lib/respond";
import { validate } from "../../_lib/validate";

const SignOutSchema = z.object({
  refreshToken: z.string().min(1),
});

export default async function signOut(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = validate(req, res, SignOutSchema);
    if (!body) return;

    await signOutWithRefreshToken(body.refreshToken);
    ok(res, { signedOut: true });
  } catch (error) {
    if (error instanceof NhostAuthError) {
      fail(res, error.message, error.status);
      return;
    }

    console.error("[admin/auth/sign-out]", error);
    fail(res, "Internal server error", 500);
  }
}
