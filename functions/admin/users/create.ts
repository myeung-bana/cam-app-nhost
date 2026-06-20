import type { Request, Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../../_lib/guards/require-admin";
import {
  fetchAdminUserByEmail,
  insertAdminUser,
  mapAdminUserRow,
} from "../../_lib/crm-data";
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
    const auth = await requireAdmin(req, res);
    if (!auth) return;

    const body = validate(req, res, CreateAdminUserSchema);
    if (!body) return;

    const existing = await fetchAdminUserByEmail(body.email);
    if (existing) {
      fail(res, "An admin user with this email already exists", 409);
      return;
    }

    const authUser = await signUpWithEmailPassword({
      email: body.email,
      displayName: body.name,
      defaultRole: "admin",
    });

    let inviteSent = false;
    try {
      await sendPasswordResetEmail(body.email, getAdminSetupUrl());
      inviteSent = true;
    } catch (error) {
      console.error("[admin/users/create] invite email failed", error);
    }

    const user = await insertAdminUser({
      name: body.name,
      email: body.email,
      role: body.role ?? "admin",
      status: "active",
      phone: body.phone ?? null,
      notes: body.notes ?? null,
      nhost_user_id: authUser.id,
    });

    await logActivity({
      type: "admin_user_created",
      label: `Admin user ${user.name} created`,
      entity_ref: user.id,
    });

    ok(res, { user: mapAdminUserRow(user), inviteSent }, 201);
  } catch (error) {
    if (error instanceof NhostAuthError) {
      fail(res, error.message, error.status);
      return;
    }

    console.error("[admin/users/create]", error);
    fail(res, "Internal server error", 500);
  }
}
