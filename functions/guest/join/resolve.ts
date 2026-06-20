import type { Request, Response } from "express";
import { isValidJoinCode } from "../../_lib/join-code";
import {
  evaluateEntry,
  toPublicEvent,
  countActiveAttendees,
} from "../../_lib/entry-rules";
import {
  fetchEventByJoinCode,
  fetchGuestSessions,
} from "../../_lib/events-data";
import { ok, fail } from "../../_lib/respond";

export default async function resolve(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const joinCode = String(req.query.joinCode ?? req.params.joinCode ?? "");

    if (!isValidJoinCode(joinCode)) {
      fail(res, "Invalid join code", 400);
      return;
    }

    const preview = req.query.preview === "true";
    const event = await fetchEventByJoinCode(joinCode);
    const sessions = event ? await fetchGuestSessions(event.id) : [];
    const activeAttendees = countActiveAttendees(sessions);
    const evaluation = evaluateEntry(event, activeAttendees, { preview });

    ok(res, {
      entryState: evaluation.entryState,
      event: evaluation.event ? toPublicEvent(evaluation.event) : null,
      activeAttendees: evaluation.activeAttendees,
      maxAttendees: evaluation.maxAttendees,
    });
  } catch (error) {
    console.error("[guest/join/resolve]", error);
    fail(res, "Internal server error", 500);
  }
}
