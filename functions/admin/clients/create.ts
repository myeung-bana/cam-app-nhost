import type { Request, Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../../_lib/guards/require-admin";
import {
  fetchClientByEmail,
  insertClient,
  mapClientRow,
} from "../../_lib/crm-data";
import { logActivity } from "../../_lib/activity-log";
import {
  getClientPortalSetupUrl,
  sendPasswordResetEmail,
  signUpWithEmailPassword,
} from "../../_lib/nhost-auth-admin";
import { NhostAuthError } from "../../_lib/nhost-auth";
import { ok, fail } from "../../_lib/respond";
import { validate } from "../../_lib/validate";

const CreateClientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  organisation: z.string().optional(),
  phone: z.string().optional(),
  wedding_date: z.string().optional(),
  event_type_preference: z.string().optional(),
  notes: z.string().optional(),
});

export default async function createClient(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const auth = await requireAdmin(req, res);
    if (!auth) return;

    const body = validate(req, res, CreateClientSchema);
    if (!body) return;

    const existing = await fetchClientByEmail(body.email);
    if (existing) {
      fail(res, "A client with this email already exists", 409);
      return;
    }

    const authUser = await signUpWithEmailPassword({
      email: body.email,
      displayName: body.name,
      defaultRole: "client",
    });

    let inviteSent = false;
    try {
      await sendPasswordResetEmail(body.email, getClientPortalSetupUrl());
      inviteSent = true;
    } catch (error) {
      console.error("[admin/clients/create] invite email failed", error);
    }

    const client = await insertClient({
      name: body.name,
      email: body.email,
      organisation: body.organisation ?? null,
      phone: body.phone ?? null,
      wedding_date: body.wedding_date ?? null,
      event_type_preference: body.event_type_preference ?? null,
      notes: body.notes ?? null,
      status: "invited",
      nhost_user_id: authUser.id,
    });

    await logActivity({
      type: "client_created",
      label: `Client ${client.name} created`,
      entity_ref: client.id,
      client_id: client.id,
    });

    ok(res, { client: mapClientRow(client), inviteSent }, 201);
  } catch (error) {
    if (error instanceof NhostAuthError) {
      fail(res, error.message, error.status);
      return;
    }

    console.error("[admin/clients/create]", error);
    fail(res, "Internal server error", 500);
  }
}
