export type EntryState =
  | "countdown"
  | "live"
  | "ended"
  | "disabled"
  | "not_found"
  | "cap_full";

export interface EventRow {
  id: string;
  name: string;
  event_type: string;
  start_time: string;
  end_time: string;
  venue_name: string | null;
  max_attendees: number;
  join_code: string;
  qr_access_enabled: boolean;
  status: string;
  accent_color: string | null;
  cover_image_url: string | null;
}

export interface EntryEvaluation {
  entryState: EntryState;
  event: EventRow | null;
  activeAttendees: number;
  maxAttendees: number;
}

const GRACE_PERIOD_MS = 30 * 60 * 1000;
const HEARTBEAT_ACTIVE_MS = 30 * 1000;

export function countActiveAttendees(
  sessions: { last_heartbeat_at: string }[],
  now = Date.now()
): number {
  return sessions.filter(
    (s) => now - new Date(s.last_heartbeat_at).getTime() <= HEARTBEAT_ACTIVE_MS
  ).length;
}

export function evaluateEntry(
  event: EventRow | null,
  activeAttendees: number,
  options?: { preview?: boolean; now?: Date }
): EntryEvaluation {
  const now = options?.now ?? new Date();

  if (!event) {
    return {
      entryState: "not_found",
      event: null,
      activeAttendees: 0,
      maxAttendees: 0,
    };
  }

  if (!event.qr_access_enabled) {
    return {
      entryState: "disabled",
      event,
      activeAttendees,
      maxAttendees: event.max_attendees,
    };
  }

  if (event.status === "archived" || event.status === "ended") {
    return {
      entryState: "ended",
      event,
      activeAttendees,
      maxAttendees: event.max_attendees,
    };
  }

  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const graceEnd = new Date(end.getTime() + GRACE_PERIOD_MS);

  if (now < start && !options?.preview) {
    return {
      entryState: "countdown",
      event,
      activeAttendees,
      maxAttendees: event.max_attendees,
    };
  }

  if (now > graceEnd) {
    return {
      entryState: "ended",
      event,
      activeAttendees,
      maxAttendees: event.max_attendees,
    };
  }

  if (activeAttendees >= event.max_attendees) {
    return {
      entryState: "cap_full",
      event,
      activeAttendees,
      maxAttendees: event.max_attendees,
    };
  }

  return {
    entryState: "live",
    event,
    activeAttendees,
    maxAttendees: event.max_attendees,
  };
}

export function canEnter(entryState: EntryState, preview?: boolean): boolean {
  if (preview) return entryState === "live" || entryState === "countdown";
  return entryState === "live";
}

export function toPublicEvent(event: EventRow) {
  return {
    id: event.id,
    name: event.name,
    eventType: event.event_type,
    startTime: event.start_time,
    endTime: event.end_time,
    venueName: event.venue_name,
    accentColor: event.accent_color,
    coverImageUrl: event.cover_image_url,
    status: event.status,
  };
}
