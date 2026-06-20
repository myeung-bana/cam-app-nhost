import type { Request, Response } from "express";
import { z } from "zod";
import { isValidJoinCode } from "../../_lib/join-code";
import {
  evaluateEntry,
  countActiveAttendees,
  canEnter,
} from "../../_lib/entry-rules";
import {
  fetchEventByJoinCode,
  fetchGuestSessions,
  insertGuestSession,
} from "../../_lib/events-data";
import { signInAnonymous, NhostAuthError } from "../../_lib/nhost-auth";
import { ok, fail } from "../../_lib/respond";
import { validate } from "../../_lib/validate";

const EnterSchema = z.object({
  joinCode: z.string().optional(),
  displayName: z.string().max(100).optional(),
  preview: z.boolean().optional(),
});

export default async function enter(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = validate(req, res, EnterSchema);
    if (!body) return;

    const joinCode = String(
      body.joinCode ?? req.query.joinCode ?? req.params.joinCode ?? ""
    );

    if (!isValidJoinCode(joinCode)) {
      fail(res, "Invalid join code", 400);
      return;
    }

    const preview = body.preview === true || req.query.preview === "true";
    const event = await fetchEventByJoinCode(joinCode);
    const sessions = event ? await fetchGuestSessions(event.id) : [];
    const activeAttendees = countActiveAttendees(sessions);
    const evaluation = evaluateEntry(event, activeAttendees, { preview });

    if (!canEnter(evaluation.entryState, preview)) {
      fail(res, `Cannot enter: ${evaluation.entryState}`, 403, {
        entryState: evaluation.entryState,
      });
      return;
    }

    if (!event) {
      fail(res, "Event not found", 404);
      return;
    }

    const authSession = await signInAnonymous({
      displayName: body.displayName,
      eventId: event.id,
    });

    const guestSession = await insertGuestSession({
      event_id: event.id,
      display_name: body.displayName ?? null,
      nhost_user_id: authSession.user.id,
    });

    ok(res, {
      entryState: evaluation.entryState,
      guestSessionId: guestSession.id,
      user: authSession.user,
      accessToken: authSession.accessToken,
      accessTokenExpiresIn: authSession.accessTokenExpiresIn,
      refreshToken: authSession.refreshToken,
    });
  } catch (error) {
    if (error instanceof NhostAuthError) {
      fail(res, error.message, error.status);
      return;
    }

    console.error("[guest/join/enter]", error);
    fail(res, "Internal server error", 500);
  }
}
