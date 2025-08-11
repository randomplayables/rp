/**
 * Explicit list of known origins used during development and for fixed hosts.
 * Keep this narrow; dynamic subdomain support is handled by isAllowedOrigin().
 */
export const allowedOrigins: string[] = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://172.31.12.157:5173",
  "http://172.31.12.157:3000",
  "http://54.153.74.18:5173",
  "http://54.153.74.18:3000",
  "https://randomplayables.com",
  "https://www.randomplayables.com",
  // keeping this explicit entry since it already exists in the repo
  "https://gothamloops.randomplayables.com",
];

/**
 * Safe, dynamic origin check.
 * - Allows exact matches in allowedOrigins
 * - Allows apex and any subdomain of randomplayables.com in prod
 * - Allows *.loca.lt only in development (useful for tunnels)
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  // Exact match first (covers localhost/IPs/fixed hosts)
  if (allowedOrigins.includes(origin)) return true;

  // Parse and evaluate hostname safely
  try {
    const url = new URL(origin);
    const host = url.hostname;

    // Allow apex + any subdomain of randomplayables.com
    if (host === "randomplayables.com" || host.endsWith(".randomplayables.com")) {
      return true;
    }

    // Dev-only convenience: allow *.loca.lt
    if (process.env.NODE_ENV !== "production" && host.endsWith(".loca.lt")) {
      return true;
    }
  } catch {
    // If origin isn't a valid URL (shouldn't happen for Origin header), reject
    return false;
  }

  return false;
}
