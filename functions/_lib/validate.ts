import type { Request, Response } from "express";
import type { ZodSchema } from "zod";
import { fail } from "./respond";

export function validate<T>(
  req: Request,
  res: Response,
  schema: ZodSchema<T>
): T | null {
  const body = req.body;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    fail(res, "Validation failed", 422, parsed.error.flatten());
    return null;
  }
  return parsed.data;
}
