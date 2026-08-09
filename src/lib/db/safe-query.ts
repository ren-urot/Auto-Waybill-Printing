// TEMPORARY: the deployed environment's DATABASE_URL points at a local-only
// port forward that Vercel's servers can't reach, so every DB call there
// throws. Wrapping call sites with this keeps pages rendering (with empty
// state) instead of 500ing during frontend-only design review. Remove once
// a real reachable DATABASE_URL is set.
export async function safeQuery<T>(queryFn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await queryFn();
  } catch {
    return fallback;
  }
}
