import type { Request, Response } from "express";
import { ok } from "./_lib/respond";

export default async function health(
  _req: Request,
  res: Response
): Promise<void> {
  ok(res, {
    status: "ok",
    service: "cam-app-nhost",
    timestamp: new Date().toISOString(),
  });
}
