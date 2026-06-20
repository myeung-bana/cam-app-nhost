import type { Request, Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../../_lib/guards/require-admin";
import {
  fetchClientById,
  updateClient,
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

const ResendInviteSchema = z.object({
  clientId: z.string().uuid().optional(),
});

export default async function resendInvite(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const auth = await requireAdmin(req, res);
    if (!auth) return;

    const body = validate(req, res, ResendInviteSchema);
    if (!body) return;

    const clientId = String(body.clientId ?? req.query.clientId ?? "");
    if (!clientId) {
      fail(res, "clientId is required", 400);
      return;
    }

    const client = await fetchClientById(clientId);
    if (!client) {
      fail(res, "Client not found", 404);
      return;
    }

    if (client.archived) {
      fail(res, "Cannot invite archived client", 400);
      return;
    }

    let nhostUserId = client.nhost_user_id;

    if (!nhostUserId) {
      const authUser = await signUpWithEmailPassword({
        email: client.email,
        displayName: client.name,
        defaultRole: "client",
      });
      nhostUserId = authUser.id;
      await updateClient(clientId, { nhost_user_id: nhostUserId });
    }

    await sendPasswordResetEmail(client.email, getClientPortalSetupUrl());

    await logActivity({
      type: "portal_invite_resent",
      label: `Portal invite resent to ${client.name}`,
      entity_ref: clientId,
      client_id: clientId,
    });

    ok(res, { clientId, inviteSent: true });
  } catch (error) {
    if (error instanceof NhostAuthError) {
      fail(res, error.message, error.status);
      return;
    }

    console.error("[admin/clients/resend-invite]", error);
    fail(res, "Internal server error", 500);
  }
}
