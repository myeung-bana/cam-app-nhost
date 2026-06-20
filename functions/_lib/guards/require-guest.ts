import type { Request, Response } from "express";
import { requireAuth } from "../auth";
import { isGuestUser } from "../roles";
import { fail } from "../respond";

export async function requireGuest(req: Request, res: Response) {
  const payload = await requireAuth(req, res);
  if (!payload) return null;

  const header = req.headers.authorization;
  const accessToken = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  if (!isGuestUser(null, accessToken)) {
    fail(res, "Guest access required", 403);
    return null;
  }

  const eventId =
    payload["https://hasura.io/jwt/claims"]?.["x-hasura-event-id"];

  if (typeof eventId !== "string" || !eventId) {
    fail(res, "Invalid guest session", 403);
    return null;
  }

  return { payload, accessToken, eventId };
}
