// Split out from mode.ts (which reads cookies() via next/headers, a
// server-only API) so the login page — a Client Component — can share the
// cookie name and type without pulling next/headers into the client bundle.
export const DEMO_MODE_COOKIE = 'omniship_demo_mode';

export type DemoMode = 'populated' | 'empty' | null;
