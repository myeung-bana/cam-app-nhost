import { hasuraAdminQuery } from "./hasura-admin";

export interface ClientRow {
  id: string;
  name: string;
  organisation: string | null;
  email: string;
  phone: string | null;
  wedding_date: string | null;
  event_type_preference: string | null;
  notes: string | null;
  status: string;
  portal_last_login_at: string | null;
  archived: boolean;
  nhost_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  notes: string | null;
  last_login_at: string | null;
  nhost_user_id: string | null;
  created_at: string;
  updated_at: string;
}

const GET_CLIENT_BY_EMAIL = `
  query GetClientByEmail($email: String!) {
    clients(where: { email: { _eq: $email } }, limit: 1) {
      id
      email
    }
  }
`;

const GET_CLIENT_BY_ID = `
  query GetClientById($id: uuid!) {
    clients_by_pk(id: $id) {
      id
      name
      organisation
      email
      phone
      wedding_date
      event_type_preference
      notes
      status
      portal_last_login_at
      archived
      nhost_user_id
      created_at
      updated_at
    }
  }
`;

const INSERT_CLIENT = `
  mutation InsertClient($object: clients_insert_input!) {
    insert_clients_one(object: $object) {
      id
      name
      organisation
      email
      phone
      wedding_date
      event_type_preference
      notes
      status
      portal_last_login_at
      archived
      nhost_user_id
      created_at
      updated_at
    }
  }
`;

const UPDATE_CLIENT = `
  mutation UpdateClient($id: uuid!, $set: clients_set_input!) {
    update_clients_by_pk(pk_columns: { id: $id }, _set: $set) {
      id
      name
      organisation
      email
      phone
      wedding_date
      event_type_preference
      notes
      status
      portal_last_login_at
      archived
      nhost_user_id
      created_at
      updated_at
    }
  }
`;

const GET_ADMIN_USER_BY_EMAIL = `
  query GetAdminUserByEmail($email: String!) {
    admin_users(where: { email: { _eq: $email } }, limit: 1) {
      id
      email
    }
  }
`;

const INSERT_ADMIN_USER = `
  mutation InsertAdminUser($object: admin_users_insert_input!) {
    insert_admin_users_one(object: $object) {
      id
      name
      email
      role
      status
      phone
      notes
      last_login_at
      nhost_user_id
      created_at
      updated_at
    }
  }
`;

export async function fetchClientByEmail(email: string) {
  const result = await hasuraAdminQuery<{
    clients: { id: string; email: string }[];
  }>(GET_CLIENT_BY_EMAIL, { email });

  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "Failed to load client");
  }

  return result.data?.clients[0] ?? null;
}

export async function fetchClientById(id: string): Promise<ClientRow | null> {
  const result = await hasuraAdminQuery<{ clients_by_pk: ClientRow | null }>(
    GET_CLIENT_BY_ID,
    { id }
  );

  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "Failed to load client");
  }

  return result.data?.clients_by_pk ?? null;
}

export async function insertClient(
  object: Record<string, unknown>
): Promise<ClientRow> {
  const result = await hasuraAdminQuery<{ insert_clients_one: ClientRow }>(
    INSERT_CLIENT,
    { object }
  );

  if (result.errors?.length || !result.data?.insert_clients_one) {
    throw new Error(result.errors?.[0]?.message ?? "Failed to create client");
  }

  return result.data.insert_clients_one;
}

export async function updateClient(
  id: string,
  set: Record<string, unknown>
): Promise<ClientRow> {
  const result = await hasuraAdminQuery<{ update_clients_by_pk: ClientRow }>(
    UPDATE_CLIENT,
    { id, set }
  );

  if (result.errors?.length || !result.data?.update_clients_by_pk) {
    throw new Error(result.errors?.[0]?.message ?? "Failed to update client");
  }

  return result.data.update_clients_by_pk;
}

export async function fetchAdminUserByEmail(email: string) {
  const result = await hasuraAdminQuery<{
    admin_users: { id: string; email: string }[];
  }>(GET_ADMIN_USER_BY_EMAIL, { email });

  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "Failed to load admin user");
  }

  return result.data?.admin_users[0] ?? null;
}

export async function insertAdminUser(
  object: Record<string, unknown>
): Promise<AdminUserRow> {
  const result = await hasuraAdminQuery<{
    insert_admin_users_one: AdminUserRow;
  }>(INSERT_ADMIN_USER, { object });

  if (result.errors?.length || !result.data?.insert_admin_users_one) {
    throw new Error(result.errors?.[0]?.message ?? "Failed to create admin user");
  }

  return result.data.insert_admin_users_one;
}

export function mapClientRow(row: ClientRow) {
  return {
    id: row.id,
    name: row.name,
    organisation: row.organisation,
    email: row.email,
    phone: row.phone,
    wedding_date: row.wedding_date,
    event_type_preference: row.event_type_preference,
    notes: row.notes,
    status: row.status,
    portal_last_login_at: row.portal_last_login_at,
    archived: row.archived,
  };
}

export function mapAdminUserRow(row: AdminUserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    phone: row.phone,
    notes: row.notes,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
