// Where to go after signing in. Only same-site paths are allowed ("//evil.com" is another site), so a crafted
// link can't bounce the user somewhere else.
export function safeNextPath(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

// Absolute link to share for a space invite
export function inviteUrl(code: string) {
  return `${window.location.origin}/invite/${code}`;
}

// Absolute link to a space itself (only useful to others when it's public)
export function spaceUrl(spaceId: string) {
  return `${window.location.origin}/space/${spaceId}`;
}
