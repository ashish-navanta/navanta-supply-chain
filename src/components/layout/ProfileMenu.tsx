"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Check } from "@phosphor-icons/react";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS, PERSONA_ORDER, type Persona } from "@/types/persona";

interface ProfileMenuProps {
  /** Controlled open state — driven by the rail's user block. */
  open: boolean;
  /** The nav that opens it. Excluded from the outside-click close so a second
   *  click on the user block toggles the popover shut instead of closing on
   *  mousedown and reopening on the click that follows. */
  triggerRef?: RefObject<HTMLElement | null>;
  /** Which surface it was opened from, which decides how far in it sits. */
  anchor?: "rail" | "panel";
  onClose: () => void;
}

function Avatar({ initials, size = 24 }: { initials: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center font-medium"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: "var(--color-iris-100)",
        color: "var(--color-iris-700)",
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
      }}
    >
      {initials}
    </span>
  );
}

export function ProfileMenu({ open, triggerRef, anchor = "rail", onClose }: ProfileMenuProps) {
  const { persona, setPersona } = usePersona();
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Esc. Listeners attach after paint, so the click
  // that opened the popover never immediately closes it.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  const current = PERSONAS[persona];

  return (
    <div
      ref={popoverRef}
      role="menu"
      /* Hangs off the rail's user block, bottom-left. Fixed rather than
         absolute because it is anchored to the nav, not to the scrolling page,
         and z-60 to clear the DS SideNav's expanded panel (z-50) — from the
         panel the menu has to sit above it, not behind. */
      className="fixed z-[60]"
      style={{
        bottom: 12,
        /* Clear of whichever surface it was opened from: the 48px rail, or the
           256px expanded panel. */
        left: anchor === "panel" ? 264 : 56,
        width: 268,
        padding: 8,
        background: "var(--surface-base)",
        border: "1px solid var(--ds-border-subtle)",
        borderRadius: 12,
        boxShadow: "var(--shadow-dropdown)",
      }}
    >
      <div className="flex w-full items-center" style={{ gap: 10, padding: "6px 8px" }}>
        <Avatar initials={current.initials} size={32} />
        <div className="flex min-w-0 flex-col" style={{ flex: 1 }}>
          <span className="type-body font-medium truncate" style={{ color: "var(--ds-text-primary)" }}>
            {current.name}
          </span>
          <span className="type-caption truncate font-normal" style={{ color: "var(--ds-text-secondary)" }}>
            {current.role}
          </span>
        </div>
      </div>

      <div className="w-full" style={{ height: 1, background: "var(--ds-border-subtle)", margin: "6px 0" }} />

      <span
        className="type-caption font-medium"
        style={{ color: "var(--ds-text-secondary)", display: "block", padding: "4px 8px" }}
      >
        Switch profile
      </span>

      {PERSONA_ORDER.map((key: Persona) => {
        const p = PERSONAS[key];
        const active = key === persona;
        return (
          <button
            key={key}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            onClick={() => {
              if (key !== persona) {
                setPersona(key);
                /* Land on the new seat's action center. The rail re-sections
                   itself around the new persona, so staying put would leave you
                   on a route the new seat has no nav entry for — which the
                   layout's seat guard would then bounce anyway. */
                router.push(p.route);
              }
              onClose();
            }}
            className="flex w-full items-center rounded-md text-left transition-colors hover:bg-[var(--sidebar-hover-bg)]"
            style={{ gap: 10, padding: "6px 8px" }}
          >
            <Avatar initials={p.initials} size={24} />
            <div className="flex min-w-0 flex-col" style={{ flex: 1 }}>
              <span className="type-body truncate font-medium" style={{ color: "var(--ds-text-primary)" }}>
                {p.name}
              </span>
              <span className="type-caption truncate font-normal" style={{ color: "var(--ds-text-secondary)" }}>
                {p.role}
              </span>
            </div>
            {active && <Check size={14} weight="bold" color="var(--color-iris-700)" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
