import type { Response } from "express";

export interface OkEnvelope<T> {
  ok: true;
  data: T;
}

export interface FailEnvelope {
  ok: false;
  error: string;
  details?: unknown;
}

export function ok<T>(res: Response, data: T, status = 200): void {
  const body: OkEnvelope<T> = { ok: true, data };
  res.status(status).json(body);
}

export function fail(
  res: Response,
  error: string,
  status = 400,
  details?: unknown
): void {
  const body: FailEnvelope = { ok: false, error };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}
