"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SideNav,
  type SideNavIconProps,
  type SideNavItem,
  type SideNavSection,
} from "@navanta-ai/design-system";
import { type Icon } from "@phosphor-icons/react";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { useActioned } from "@/lib/actioned";
import { NAV, activeEntry, type NavEntry } from "@/data/nav";
import { QUEUES } from "@/data/action-center";
import { ProfileMenu } from "./ProfileMenu";

/**
 * The seat's rail. Routes live in `key` and deliberately omit `href`: SideNav
 * renders an href item as a plain anchor, and a full page load would drop the
 * persona context and any modal state the demo is mid-way through.
 */

/**
 * The DS SideNav has no badge slot, so the count rides in through the icon — the
 * same technique the Allison procurement rail uses. Rendered at both the 20px
 * rail size and the 16px panel size without a second component.
 *
 * Only ever a count, and only ever on the action center. The dot variant that
 * used to mark drift and ETA conflicts is gone with them.
 */
function withBadge(Glyph: Icon, value: number) {
  function BadgedIcon(props: SideNavIconProps) {
    return (
      <span className="relative inline-flex">
        <Glyph {...props} />
        {value > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold"
            /* Light disc, dark numeral — inverted from the rest of the rail.
               The iris gradient it carried is a dark fill under white text,
               which was right on a white rail and reads as a dark blot on the near-black.
               A translucent white would have kept the count legible at 9px only
               by accident: the tint has to stay dark enough to hold white text,
               and a badge that dark is what we are moving away from. So the disc
               goes solid white and the figure goes near-black — the highest contrast
               available at this size, and unmistakably light against the
               ground. */
            style={{
              background: "var(--nav-brand)",
              color: "#FFFFFF",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </span>
        )}
      </span>
    );
  }
  return BadgedIcon;
}

/* eslint-disable @next/next/no-img-element */

/**
 * Full Navanta lockup — the expanded panel.
 *
 * The full dark lockup keeps the brand visible against the white navigation
 * surface.
 */
function FullLogo() {
  return (
    <img
      src="/navanta-logo.svg"
      alt="Navanta"
      className="px-1"
      style={{ height: 32, width: "auto" }}
    />
  );
}

/** The compact Navanta mark shown above the navigation icons. */
function CompactLogo() {
  return (
    <img
      src="/Navanta_Logo.svg"
      alt="Navanta"
      style={{
        height: 28,
        width: "auto",
        transform: "translateX(2px)",
      }}
    />
  );
}

export function Sidebar({
  expanded,
  onExpandedChange,
}: {
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { persona } = usePersona();
  const profile = PERSONAS[persona];

  /* The one live count on the rail: lines in this seat's queue that need a
     decision. Read from the same fixture the queue renders, so the badge and
     the table can't disagree. */
  const actioned = useActioned();
  const needsDecision = actioned
    .live(QUEUES[persona].rows)
    .filter((r) => r.state === "decide").length;

  const iconFor = (entry: NavEntry) =>
    entry.badge ? withBadge(entry.icon, needsDecision) : entry.icon;

  const sections = useMemo<SideNavSection[]>(
    () =>
      NAV[persona].map((group) => ({
        label: group.label,
        items: group.entries.map((entry) => ({
          key: entry.key,
          label: entry.label,
          icon: iconFor(entry),
        })),
      })),
    // The count is derived from a module-level fixture, so persona is the only
    // thing that actually changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persona],
  );

  /* The seat switcher hangs off the rail's own user block — the DS gives us
     `onUserClick` for exactly this, and the profile is a property of the
     navigation, not of the page you happen to be on. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<"rail" | "panel">("rail");
  /* The whole nav, rail and expanded panel, counts as the trigger. The DS owns
     the user button, so there is no ref to it; excluding the nav wholesale
     keeps the mousedown that closes the menu from firing before the click that
     would reopen it — which is what makes a second click actually close it. */
  const navRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (item: SideNavItem) => {
    setMenuOpen(false);
    router.push(item.key);
  };

  return (
    /* `contents` so the wrapper is invisible to layout — SideNav's rail is a
       flex child of the app shell and must stay one.
       The DS SideNav paints itself with `--surface-base`, so rather than fork
       the component the variable is rebound for this subtree only: inside the
       rail, "base surface" means the chrome grey. Custom properties inherit
       through `display: contents`, so the invisible wrapper still carries it,
       and every card elsewhere on the page keeps its white. */
    <div
      ref={navRef}
      className="contents"
      style={{ "--surface-base": "var(--surface-chrome)" } as React.CSSProperties}
    >
      <SideNav
        sections={sections}
        activeKey={activeEntry(persona, pathname)?.key}
        onNavigate={handleNavigate}
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        logo={<FullLogo />}
        logoCollapsed={<CompactLogo />}
        user={{
          name: profile.name,
          description: profile.role,
          initials: profile.initials,
           /* Solid Navanta blue keeps the white initials legible against the
             white rail. */
           color: "var(--nav-brand)",
        }}
        onUserClick={(from) => {
          setAnchor(from);
          setMenuOpen((v) => !v);
        }}
      />

      <ProfileMenu
        open={menuOpen}
        anchor={anchor}
        triggerRef={navRef}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
