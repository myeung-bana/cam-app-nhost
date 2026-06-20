import jwt from "jsonwebtoken";
import type { JwtPayload } from "./auth";
import { ADMIN_ROLE, CLIENT_ROLE, GUEST_ROLE } from "./constants";

interface HasuraJwtClaims {
  "https://hasura.io/jwt/claims"?: {
    "x-hasura-default-role"?: string;
    "x-hasura-allowed-roles"?: string[] | string;
  };
}

interface AuthUserLike {
  defaultRole?: string;
  roles?: string[];
}

function normalizeAllowedRoles(
  allowed: string[] | string | undefined
): string[] {
  if (!allowed) return [];
  if (Array.isArray(allowed)) return allowed;
  if (allowed.startsWith("{") && allowed.endsWith("}")) {
    return allowed
      .slice(1, -1)
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
  }
  return [allowed];
}

function hasRole(
  role: string,
  user?: AuthUserLike | null,
  accessToken?: string | null
): boolean {
  if (user?.defaultRole === role) return true;
  if (user?.roles?.includes(role)) return true;

  if (!accessToken) return false;

  try {
    const decoded = jwt.decode(accessToken) as HasuraJwtClaims | null;
    if (!decoded) return false;
    const claims = decoded["https://hasura.io/jwt/claims"];
    const defaultRole = claims?.["x-hasura-default-role"];
    const allowedRoles = normalizeAllowedRoles(
      claims?.["x-hasura-allowed-roles"]
    );
    return defaultRole === role || allowedRoles.includes(role);
  } catch {
    return false;
  }
}

export function isAdminUser(
  user?: AuthUserLike | null,
  accessToken?: string | null
): boolean {
  return hasRole(ADMIN_ROLE, user, accessToken);
}

export function isClientUser(
  user?: AuthUserLike | null,
  accessToken?: string | null
): boolean {
  return hasRole(CLIENT_ROLE, user, accessToken);
}

export function isGuestUser(
  user?: AuthUserLike | null,
  accessToken?: string | null
): boolean {
  return hasRole(GUEST_ROLE, user, accessToken);
}

export function getDefaultRole(payload: JwtPayload): string | null {
  return (
    payload["https://hasura.io/jwt/claims"]?.["x-hasura-default-role"] ?? null
  );
}
