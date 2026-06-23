import type { Request, Response } from "express";
import { z } from "zod";
import { requireGuest } from "../../_lib/guards/require-guest";
import { getUserId } from "../../_lib/auth";
import { touchGuestSessionHeartbeat } from "../../_lib/events-data";
import { handleCorsPreflight } from "../../_lib/cors";
import { ok, fail } from "../../_lib/respond";
import { validate } from "../../_lib/validate";

const HeartbeatSchema = z.object({
  guestSessionId: z.string().uuid(),
});

export default async function heartbeat(
  req: Request,
  res: Response
): Promise<void> {
  if (handleCorsPreflight(req, res)) return;

  try {
    const auth = await requireGuest(req, res);
    if (!auth) return;

    const body = validate(req, res, HeartbeatSchema);
    if (!body) return;

    const userId = getUserId(auth.payload);
    if (!userId) {
      fail(res, "Invalid guest session", 403);
      return;
    }

    const updated = await touchGuestSessionHeartbeat(
      body.guestSessionId,
      auth.eventId,
      userId
    );

    if (!updated) {
      fail(res, "Session not found", 404);
      return;
    }

    ok(res, { guestSessionId: updated.id, lastHeartbeatAt: updated.last_heartbeat_at });
  } catch (error) {
    console.error("[guest/session/heartbeat]", error);
    fail(res, "Internal server error", 500);
  }
}
