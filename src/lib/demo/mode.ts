import { cookies } from 'next/headers';
import { DEMO_MODE_COOKIE, type DemoMode } from './mode-constants';

export { DEMO_MODE_COOKIE, type DemoMode };

// Lets the login screen offer two honest demo paths without a real
// multi-tenant backend: "Sign up" (a brand-new account, correctly empty)
// vs. "Log in" (an existing account with data already in it). The cookie
// only ever *adds* mock data on top of an empty real result — it never
// hides real data that is actually there.
export async function getDemoMode(): Promise<DemoMode> {
  const store = await cookies();
  const value = store.get(DEMO_MODE_COOKIE)?.value;
  return value === 'populated' || value === 'empty' ? value : null;
}
