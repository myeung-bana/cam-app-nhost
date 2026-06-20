import type { Request, Response } from "express";
import QRCode from "qrcode";
import { requireAdmin } from "../../_lib/guards/require-admin";
import { fetchEventById } from "../../_lib/events-data";
import { env } from "../../_lib/env";
import { ok, fail } from "../../_lib/respond";

export default async function getQr(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const auth = await requireAdmin(req, res);
    if (!auth) return;

    const eventId = String(req.query.eventId ?? "");
    if (!eventId) {
      fail(res, "eventId is required", 400);
      return;
    }

    const event = await fetchEventById(eventId);
    if (!event) {
      fail(res, "Event not found", 404);
      return;
    }

    const joinUrl = `${env.guestAppUrl}/j/${event.join_code}`;
    const svg = await QRCode.toString(joinUrl, { type: "svg" });

    ok(res, {
      joinUrl,
      joinCode: event.join_code,
      svg,
    });
  } catch (error) {
    console.error("[admin/events/get-qr]", error);
    fail(res, "Internal server error", 500);
  }
}
