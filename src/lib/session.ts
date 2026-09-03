/**
 * The demo sign-in.
 *
 * A cookie, not an identity: this portal is a walkthrough, and the login page
 * exists to make the front door feel like a product — pick the company, sign
 * in, land in its world. Nothing is verified, nothing leaves the browser, and
 * the cookie carries only the fact that the door was opened and by which
 * display name. Real authentication is a different project.
 */

const COOKIE = "navanta_session";
const MAX_AGE = 60 * 60 * 12; // a working day

/**
 * The one demo account. Checked in the browser, which is exactly as secure as
 * it sounds — this keeps a walkthrough from being opened by a typo, nothing
 * more. Swap for real auth before anything confidential sits behind it.
 */
export const DEMO_CREDENTIALS = {
  email: "admin@admin.com",
  password: "navanta-100m",
} as const;

export function credentialsValid(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password
  );
}

export interface Session {
  /** What the person typed in the email field — shown, never checked. */
  email: string;
  /** Which company they chose at the door. */
  company: string;
}

/** Read the session cookie. Client-only; null when nobody has signed in. */
export function clientReadSession(): Session | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${COOKIE}=`));
  if (!match) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match.slice(COOKIE.length + 1))) as Partial<Session>;
    return parsed.email && parsed.company ? { email: parsed.email, company: parsed.company } : null;
  } catch {
    return null;
  }
}

export function clientSetSession(session: Session): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(session));
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function clientClearSession(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
