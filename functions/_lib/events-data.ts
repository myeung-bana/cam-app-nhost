import { hasuraAdminQuery } from "./hasura-admin";
import { logActivity } from "./activity-log";
import type { EventRow } from "./entry-rules";

const GET_EVENT_BY_JOIN_CODE = `
  query GetEventByJoinCode($joinCode: String!) {
    events(where: { join_code: { _eq: $joinCode } }, limit: 1) {
      id
      name
      event_type
      start_time
      end_time
      venue_name
      max_attendees
      join_code
      qr_access_enabled
      status
      accent_color
      cover_image_url
    }
  }
`;

const GET_EVENT_BY_ID = `
  query GetEventById($id: uuid!) {
    events_by_pk(id: $id) {
      id
      name
      event_type
      start_time
      end_time
      venue_name
      max_attendees
      join_code
      qr_access_enabled
      status
      accent_color
      cover_image_url
    }
  }
`;

const GET_ACTIVE_SESSIONS = `
  query GetActiveSessions($eventId: uuid!) {
    guest_sessions(where: { event_id: { _eq: $eventId } }) {
      last_heartbeat_at
    }
  }
`;

const INSERT_GUEST_SESSION = `
  mutation InsertGuestSession($object: guest_sessions_insert_input!) {
    insert_guest_sessions_one(object: $object) {
      id
      event_id
      display_name
      joined_at
      last_heartbeat_at
    }
  }
`;

const UPDATE_EVENT_JOIN_CODE = `
  mutation UpdateEventJoinCode($id: uuid!, $joinCode: String!, $rotatedAt: timestamptz!) {
    update_events_by_pk(
      pk_columns: { id: $id }
      _set: { join_code: $joinCode, join_code_rotated_at: $rotatedAt }
    ) {
      id
      join_code
    }
  }
`;

export async function fetchEventByJoinCode(
  joinCode: string
): Promise<EventRow | null> {
  const result = await hasuraAdminQuery<{
    events: EventRow[];
  }>(GET_EVENT_BY_JOIN_CODE, { joinCode });

  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "Failed to load event");
  }

  return result.data?.events[0] ?? null;
}

export async function fetchEventById(id: string): Promise<EventRow | null> {
  const result = await hasuraAdminQuery<{ events_by_pk: EventRow | null }>(
    GET_EVENT_BY_ID,
    { id }
  );

  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "Failed to load event");
  }

  return result.data?.events_by_pk ?? null;
}

export async function fetchGuestSessions(eventId: string) {
  const result = await hasuraAdminQuery<{
    guest_sessions: { last_heartbeat_at: string }[];
  }>(GET_ACTIVE_SESSIONS, { eventId });

  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "Failed to load sessions");
  }

  return result.data?.guest_sessions ?? [];
}

export async function insertGuestSession(input: {
  event_id: string;
  display_name?: string | null;
  nhost_user_id?: string | null;
}) {
  const result = await hasuraAdminQuery<{
    insert_guest_sessions_one: {
      id: string;
      event_id: string;
      display_name: string | null;
    };
  }>(INSERT_GUEST_SESSION, {
    object: {
      ...input,
      last_heartbeat_at: new Date().toISOString(),
    },
  });

  if (result.errors?.length || !result.data?.insert_guest_sessions_one) {
    throw new Error(result.errors?.[0]?.message ?? "Failed to create session");
  }

  return result.data.insert_guest_sessions_one;
}

export async function rotateEventJoinCode(eventId: string, joinCode: string) {
  const result = await hasuraAdminQuery<{
    update_events_by_pk: { id: string; join_code: string };
  }>(UPDATE_EVENT_JOIN_CODE, {
    id: eventId,
    joinCode,
    rotatedAt: new Date().toISOString(),
  });

  if (result.errors?.length || !result.data?.update_events_by_pk) {
    throw new Error(result.errors?.[0]?.message ?? "Failed to rotate join code");
  }

  return result.data.update_events_by_pk;
}

export { logActivity } from "./activity-log";
