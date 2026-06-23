import type { Request, Response } from "express";

const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, Accept, Origin";

/**
 * Nhost forwards OPTIONS preflight to the function — respond before body validation.
 * @see https://docs.nhost.io/products/functions/guides/cors/
 */
export function handleCorsPreflight(req: Request, res: Response): boolean {
  if (req.method !== "OPTIONS") {
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
  return true;
}
