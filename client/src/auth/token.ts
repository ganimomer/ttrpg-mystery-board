// In-memory session token used when running as a Discord Activity, where the
// cross-site iframe can't rely on cookies. Held in memory only (never persisted)
// and attached as a Bearer header / ?token= query by the API layer.
let sessionToken: string | null = null;

export function setToken(token: string | null): void {
  sessionToken = token;
}

export function getToken(): string | null {
  return sessionToken;
}
