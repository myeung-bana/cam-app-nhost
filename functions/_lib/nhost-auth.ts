import { env } from "./env";

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  defaultRole?: string;
  roles?: string[];
}

export interface AuthSessionPayload {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user: AuthUser;
}

interface NhostSession {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user?: {
    id: string;
    email?: string;
    displayName?: string;
    defaultRole?: string;
    roles?: string[];
  };
}

interface SignInEmailPasswordResponse {
  session?: NhostSession;
  mfa?: unknown;
}

interface SessionPayload {
  session?: NhostSession;
}

export class NhostAuthError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "NhostAuthError";
  }
}

function mapUser(user: NhostSession["user"]): AuthUser {
  if (!user?.id) {
    throw new NhostAuthError("Invalid user payload", 500);
  }

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: user.displayName,
    defaultRole: user.defaultRole,
    roles: user.roles,
  };
}

function mapSession(session: NhostSession): AuthSessionPayload {
  return {
    accessToken: session.accessToken,
    accessTokenExpiresIn: session.accessTokenExpiresIn,
    refreshToken: session.refreshToken,
    user: mapUser(session.user),
  };
}

async function parseAuthResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new NhostAuthError(
      body.message ?? body.error ?? fallbackMessage,
      response.status
    );
  }

  return body as T;
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<AuthSessionPayload> {
  const response = await fetch(`${env.authUrl}/signin/email-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await parseAuthResponse<SignInEmailPasswordResponse>(
    response,
    "Invalid credentials"
  );

  if (body.mfa) {
    throw new NhostAuthError("MFA is not supported for admin sign-in", 403);
  }

  if (!body.session) {
    throw new NhostAuthError("Invalid credentials", 401);
  }

  return mapSession(body.session);
}

export async function refreshAuthSession(
  refreshToken: string
): Promise<AuthSessionPayload> {
  const response = await fetch(`${env.authUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const body = await parseAuthResponse<SessionPayload>(
    response,
    "Session refresh failed"
  );

  if (!body.session) {
    throw new NhostAuthError("Session refresh failed", 401);
  }

  return mapSession(body.session);
}

export async function signOutWithRefreshToken(
  refreshToken: string
): Promise<void> {
  const response = await fetch(`${env.authUrl}/signout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new NhostAuthError("Sign out failed", response.status);
  }
}

interface SignInAnonymousResponse {
  session?: NhostSession;
}

export async function signInAnonymous(options?: {
  displayName?: string;
  eventId?: string;
}): Promise<AuthSessionPayload> {
  const response = await fetch(`${env.authUrl}/signin/anonymous`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: options?.displayName,
      metadata: options?.eventId ? { eventId: options.eventId } : undefined,
    }),
  });

  const body = await parseAuthResponse<SignInAnonymousResponse>(
    response,
    "Anonymous sign-in failed"
  );

  if (!body.session) {
    throw new NhostAuthError("Anonymous sign-in failed", 500);
  }

  return mapSession(body.session);
}
