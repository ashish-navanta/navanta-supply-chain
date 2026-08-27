import { isPersona, type Persona } from "@/types/persona";

const COOKIE = "navanta_persona";

/** Read the active persona from the cookie. Client-only. */
export function clientReadPersona(): Persona | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE}=`));
  const value = match?.split("=")[1];
  return isPersona(value) ? value : null;
}

/** Persist the persona and notify subscribers — cookies fire no native event. */
export function clientSetPersona(next: Persona): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  window.dispatchEvent(new Event("shaw:persona-change"));
}
