"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Persona } from "@/types/persona";
import { clientReadPersona, clientSetPersona } from "@/lib/persona";

interface PersonaContextValue {
  persona: Persona;
  setPersona: (next: Persona) => void;
}

const PersonaContext = createContext<PersonaContextValue | undefined>(undefined);

interface PersonaProviderProps {
  /** Server-resolved starting value. Defaults to the buyer — the first seat
   *  the workshop's order passes through. */
  initialPersona?: Persona;
  children: ReactNode;
}

export function PersonaProvider({
  initialPersona = "buyer",
  children,
}: PersonaProviderProps) {
  // The persona lives in a cookie so it survives reloads. Server and client
  // must agree on the first render or React throws a hydration mismatch —
  // `useSyncExternalStore` takes separate server/client snapshots, letting the
  // server render `initialPersona` while the client hydrates off the cookie.
  const persona = useSyncExternalStore(
    (notify) => {
      window.addEventListener("shaw:persona-change", notify);
      return () => window.removeEventListener("shaw:persona-change", notify);
    },
    () => clientReadPersona() ?? initialPersona,
    () => initialPersona,
  );

  const setPersona = useCallback((next: Persona) => {
    clientSetPersona(next);
  }, []);

  return (
    <PersonaContext.Provider value={{ persona, setPersona }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used inside a PersonaProvider");
  return ctx;
}
