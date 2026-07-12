import type { Request, Response } from "express";

interface AccessTokenHookBody {
  user?: {
    id?: string;
    metadata?: Record<string, unknown> | null;
    defaultRole?: string;
    roles?: string[];
  };
  session?: {
    user?: {
      id?: string;
      metadata?: Record<string, unknown> | null;
      defaultRole?: string;
      roles?: string[];
    };
  };
}

/**
 * Nhost custom access token hook — maps guest metadata.eventId → x-hasura-event-id.
 * Configure in Nhost Dashboard → Auth → Hooks → Custom access token.
 */
export default async function accessTokenHook(
  req: Request,
  res: Response
): Promise<void> {
  const body = req.body as AccessTokenHookBody;
  const user = body.user ?? body.session?.user;

  if (!user?.id) {
    res.status(400).json({ message: "Missing user" });
    return;
  }

  const metadata =
    user.metadata && typeof user.metadata === "object" && !Array.isArray(user.metadata)
      ? user.metadata
      : {};
  const eventId =
    typeof metadata.eventId === "string"
      ? metadata.eventId
      : typeof metadata.event_id === "string"
        ? metadata.event_id
        : undefined;
  const defaultRole =
    eventId && (user.defaultRole === "anonymous" || !user.defaultRole)
      ? "guest"
      : (user.defaultRole ?? "user");
  const allowedRoles = user.roles?.length
    ? [...new Set([...user.roles, defaultRole, ...(eventId ? ["guest"] : [])])]
    : eventId
      ? ["guest", "anonymous"]
      : [defaultRole];

  const claims: Record<string, string> = {
    "x-hasura-allowed-roles": `{${allowedRoles.join(",")}}`,
    "x-hasura-default-role": defaultRole,
    "x-hasura-user-id": user.id,
  };

  if (eventId && (defaultRole === "guest" || allowedRoles.includes("guest"))) {
    claims["x-hasura-event-id"] = eventId;
  }

  res.status(200).json({
    claims: {
      "https://hasura.io/jwt/claims": claims,
    },
  });
}
