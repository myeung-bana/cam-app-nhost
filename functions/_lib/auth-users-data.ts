import { hasuraAdminQuery } from "./hasura-admin";

export interface AuthUserRow {
  id: string;
  email: string;
  displayName?: string | null;
  disabled: boolean;
  lastSeen?: string | null;
  createdAt: string;
  updatedAt?: string;
  phoneNumber?: string | null;
  metadata?: unknown;
  roles: Array<{ role: string }>;
}

const GET_AUTH_USER_BY_EMAIL = `
  query GetAuthUserByEmail($email: String!) {
    users(where: { email: { _eq: $email } }, limit: 1) {
      id
      email
      roles {
        role
      }
    }
  }
`;

export function hasAdminRole(roles: Array<{ role: string }>): boolean {
  return roles.some((entry) => entry.role === "admin");
}

export function buildAdminUserMetadata(input: {
  role?: "owner" | "admin";
  phone?: string | null;
  notes?: string | null;
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (input.role) metadata.adminRole = input.role;
  if (input.notes) metadata.notes = input.notes;
  if (input.phone) metadata.phone = input.phone;
  return metadata;
}

export function mapAuthUserToAdminUser(row: AuthUserRow) {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  const adminRole =
    metadata.adminRole === "owner" || metadata.adminRole === "admin"
      ? metadata.adminRole
      : "admin";

  return {
    id: row.id,
    name: row.displayName?.trim() || row.email,
    email: row.email,
    role: adminRole,
    status: row.disabled ? "inactive" : "active",
    phone: row.phoneNumber ?? (typeof metadata.phone === "string" ? metadata.phone : null),
    notes: typeof metadata.notes === "string" ? metadata.notes : null,
    last_login_at: row.lastSeen ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function fetchAuthUserByEmail(email: string) {
  const result = await hasuraAdminQuery<{
    users: Array<{ id: string; email: string; roles: Array<{ role: string }> }>;
  }>(GET_AUTH_USER_BY_EMAIL, { email });

  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "Failed to load auth user");
  }

  return result.data?.users[0] ?? null;
}

export async function updateAuthUser(
  id: string,
  set: Record<string, unknown>
): Promise<AuthUserRow> {
  const UPDATE_AUTH_USER = `
    mutation UpdateAuthUser($id: uuid!, $set: users_set_input!) {
      updateUser(pk_columns: { id: $id }, _set: $set) {
        id
        email
        displayName
        disabled
        lastSeen
        createdAt
        updatedAt
        phoneNumber
        metadata
        roles {
          role
        }
      }
    }
  `;

  const result = await hasuraAdminQuery<{ updateUser: AuthUserRow }>(
    UPDATE_AUTH_USER,
    { id, set }
  );

  if (result.errors?.length || !result.data?.updateUser) {
    throw new Error(result.errors?.[0]?.message ?? "Failed to update auth user");
  }

  return result.data.updateUser;
}
