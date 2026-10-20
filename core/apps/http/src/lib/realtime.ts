import type { InternalEvent, InternalUserEvent } from "@repo/protocol";

// Changes are pushed to the people affected by apps/ws. Reporting is best-effort: the change is already saved,
// and anyone who joins later loads it from the database anyway.
const NOTIFY_TIMEOUT_MS = 2000;

/** A space's furniture, map or settings changed: tell everyone in it. */
export function notifySpace(spaceId: string, event: InternalEvent) {
  post(`spaces/${encodeURIComponent(spaceId)}`, event);
}

/** Something about a user changed (their avatar): tell whichever space they're in. */
export function notifyUser(userId: string, event: InternalUserEvent) {
  post(`users/${encodeURIComponent(userId)}`, event);
}

function post(target: string, event: InternalEvent | InternalUserEvent) {
  const baseUrl = process.env.WS_INTERNAL_URL;
  const secret = process.env.INTERNAL_SECRET;
  if (!baseUrl || !secret) {
    console.warn("realtime: WS_INTERNAL_URL or INTERNAL_SECRET not set; live updates are off");
    return;
  }

  fetch(`${baseUrl}/internal/${target}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
  })
    .then((res) => {
      if (!res.ok) console.error(`realtime: ws server answered ${res.status} for ${event.type}`);
    })
    .catch((e) => console.error(`realtime: could not reach ws server for ${event.type}`, e));
}
