import type { Request, Response } from "express";
import { z } from "zod";
import { requireAdminAccess } from "../../_lib/guards/require-admin-access";
import {
  buildAdminUserMetadata,
  fetchAuthUserByEmail,
  hasAdminRole,
  mapAuthUserToAdminUser,
  updateAuthUser,
} from "../../_lib/auth-users-data";
import { logActivity } from "../../_lib/activity-log";
import {
  sendPasswordResetEmail,
  signUpWithEmailPassword,
} from "../../_lib/nhost-auth-admin";
import { NhostAuthError } from "../../_lib/nhost-auth";
import { ok, fail } from "../../_lib/respond";
import { validate } from "../../_lib/validate";

const CreateAdminUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["owner", "admin"]).optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

function getAdminSetupUrl(): string {
  const base =
    process.env.ADMIN_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/login`;
}

export default async function createAdminUser(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const auth = await requireAdminAccess(req, res);
    if (!auth) return;

    const body = validate(req, res, CreateAdminUserSchema);
    if (!body) return;

    const existing = await fetchAuthUserByEmail(body.email);
    if (existing && hasAdminRole(existing.roles)) {
      fail(res, "An admin user with this email already exists", 409);
      return;
    }

    const authUser = await signUpWithEmailPassword({
      email: body.email,
      displayName: body.name,
      defaultRole: "admin",
    });

    const user = await updateAuthUser(authUser.id, {
      displayName: body.name,
      phoneNumber: body.phone ?? null,
      metadata: buildAdminUserMetadata({
        role: body.role ?? "admin",
        phone: body.phone ?? null,
        notes: body.notes ?? null,
      }),
    });

    let inviteSent = false;
    try {
      await sendPasswordResetEmail(body.email, getAdminSetupUrl());
      inviteSent = true;
    } catch (error) {
      console.error("[admin/users/create] invite email failed", error);
    }

    await logActivity({
      type: "admin_user_created",
      label: `Admin user ${user.displayName ?? body.name} created`,
      entity_ref: user.id,
    });

    ok(res, { user: mapAuthUserToAdminUser(user), inviteSent }, 201);
  } catch (error) {
    if (error instanceof NhostAuthError) {
      fail(res, error.message, error.status);
      return;
    }

    console.error("[admin/users/create]", error);
    fail(res, "Internal server error", 500);
  }
}
