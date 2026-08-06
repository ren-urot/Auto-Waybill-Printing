export function isAuthorizedCronRequest(authHeader: string | null, secret: string): boolean {
  return authHeader === `Bearer ${secret}`;
}
