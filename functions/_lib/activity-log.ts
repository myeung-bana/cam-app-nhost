import { hasuraAdminQuery } from "./hasura-admin";

const INSERT_ACTIVITY = `
  mutation InsertActivity($object: activity_log_insert_input!) {
    insert_activity_log_one(object: $object) {
      id
    }
  }
`;

export async function logActivity(input: {
  type: string;
  label: string;
  entity_ref?: string;
  event_id?: string;
  client_id?: string;
}) {
  await hasuraAdminQuery(INSERT_ACTIVITY, {
    object: {
      type: input.type,
      label: input.label,
      entity_ref: input.entity_ref ?? null,
      event_id: input.event_id ?? null,
      client_id: input.client_id ?? null,
    },
  });
}
