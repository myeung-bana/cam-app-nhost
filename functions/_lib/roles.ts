import jwt from "jsonwebtoken";

export const ADMIN_ROLE = "admin";

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

export function isAdminUser(
  user?: AuthUserLike | null,
  accessToken?: string | null
): boolean {
  if (user?.defaultRole === ADMIN_ROLE) return true;
  if (user?.roles?.includes(ADMIN_ROLE)) return true;

  if (!accessToken) return false;

  try {
    const decoded = jwt.decode(accessToken) as HasuraJwtClaims | null;
    if (!decoded) return false;

    const claims = decoded["https://hasura.io/jwt/claims"];
    const defaultRole = claims?.["x-hasura-default-role"];
    const allowedRoles = normalizeAllowedRoles(
      claims?.["x-hasura-allowed-roles"]
    );

    return defaultRole === ADMIN_ROLE || allowedRoles.includes(ADMIN_ROLE);
  } catch {
    return false;
  }
}
