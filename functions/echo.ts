import type { Request, Response } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "./_lib/auth";
import { ok, fail } from "./_lib/respond";
import { validate } from "./_lib/validate";

const EchoSchema = z.object({
  message: z.string().min(1).max(500),
});

export default async function echo(req: Request, res: Response): Promise<void> {
  try {
    const payload = await requireAuth(req, res);
    if (!payload) return;

    const body = validate(req, res, EchoSchema);
    if (!body) return;

    const userId = getUserId(payload);
    if (!userId) {
      fail(res, "Unauthorized", 401);
      return;
    }

    ok(res, {
      message: body.message,
      userId,
    });
  } catch (error) {
    console.error("[echo]", error);
    fail(res, "Internal server error", 500);
  }
}
