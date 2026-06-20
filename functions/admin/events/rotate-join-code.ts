import type { Request, Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../../_lib/guards/require-admin";
import { generateJoinCode } from "../../_lib/join-code";
import {
  fetchEventById,
  rotateEventJoinCode,
  logActivity,
} from "../../_lib/events-data";
import { ok, fail } from "../../_lib/respond";
import { validate } from "../../_lib/validate";

const RotateSchema = z.object({
  eventId: z.string().uuid(),
});

export default async function rotateJoinCode(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const auth = await requireAdmin(req, res);
    if (!auth) return;

    const body = validate(req, res, RotateSchema);
    if (!body) return;

    const event = await fetchEventById(body.eventId);
    if (!event) {
      fail(res, "Event not found", 404);
      return;
    }

    const newJoinCode = generateJoinCode();
    const updated = await rotateEventJoinCode(body.eventId, newJoinCode);

    await logActivity({
      type: "join_code_rotated",
      label: `Join code rotated for event ${event.name}`,
      entity_ref: body.eventId,
      event_id: body.eventId,
    });

    ok(res, {
      eventId: updated.id,
      joinCode: updated.join_code,
      previousJoinCode: event.join_code,
    });
  } catch (error) {
    console.error("[admin/events/rotate-join-code]", error);
    fail(res, "Internal server error", 500);
  }
}
