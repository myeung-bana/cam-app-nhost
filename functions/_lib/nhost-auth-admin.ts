import { randomBytes } from "crypto";
import { env } from "./env";
import { NhostAuthError } from "./nhost-auth";

export interface ProvisionedAuthUser {
  id: string;
  email: string;
  displayName?: string;
  defaultRole?: string;
}

interface SignUpResponse {
  session?: {
    user?: {
      id: string;
      email?: string;
      displayName?: string;
      defaultRole?: string;
    };
  };
}

function generateTemporaryPassword(): string {
  return randomBytes(24).toString("base64url");
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

export async function signUpWithEmailPassword(input: {
  email: string;
  displayName: string;
  defaultRole: "client" | "admin";
}): Promise<ProvisionedAuthUser> {
  const password = generateTemporaryPassword();

  const response = await fetch(`${env.authUrl}/signup/email-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      password,
      options: {
        displayName: input.displayName,
        defaultRole: input.defaultRole,
      },
    }),
  });

  const body = await parseAuthResponse<SignUpResponse>(
    response,
    "Failed to create auth user"
  );

  const user = body.session?.user;
  if (!user?.id) {
    throw new NhostAuthError("Failed to create auth user", 500);
  }

  return {
    id: user.id,
    email: user.email ?? input.email,
    displayName: user.displayName ?? input.displayName,
    defaultRole: user.defaultRole ?? input.defaultRole,
  };
}

export async function sendPasswordResetEmail(
  email: string,
  redirectTo?: string
): Promise<void> {
  const response = await fetch(`${env.authUrl}/user/password/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      options: redirectTo ? { redirectTo } : undefined,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new NhostAuthError(
      body.message ?? body.error ?? "Failed to send invite email",
      response.status
    );
  }
}

export function getClientPortalSetupUrl(): string {
  return `${env.clientPortalUrl}/portal/setup`;
}
