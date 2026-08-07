export function isAuthorizedCronRequest(authHeader: string | null, secret: string): boolean {
  // Fail closed. Without this, an unset CRON_SECRET (passed in as '') would
  // make the literal header `Authorization: Bearer ` authorize the request,
  // leaving the cron route wide open on any deploy that forgot the env var.
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
