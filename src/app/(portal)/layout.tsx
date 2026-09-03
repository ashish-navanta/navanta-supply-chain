"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ChatPanelProvider } from "@/context/ChatPanelContext";
import { PersonaProvider, usePersona } from "@/context/PersonaContext";
import { ScopeProvider } from "@/context/ScopeContext";
import { ProductPeekProvider } from "@/context/ProductPeekContext";
import { clientReadPersona } from "@/lib/persona";
import { clientReadSession } from "@/lib/session";
import { PERSONAS, type Persona } from "@/types/persona";
import { activeEntry, seatOwning } from "@/data/nav";

/**
 * Keeps the seat and the route together.
 *
 * Each seat used to own exactly one page, so the two could not disagree. Now
 * that buying and service have several each, a persona switch or a stale link
 * can leave Priya standing on /buying — which renders the buyer's command center
 * with the planner's name and queue counts on it. The rail is the authority on
 * where a seat can be: if the path is not one of its entries, send them home.
 *
 * The guard only bites AFTER mount, and that is load-bearing. The persona lives
 * in a cookie the client reads; the server has to guess, and it guesses "buyer".
 * Judging the route on that guess bounced every service deep link twice — first
 * off /service/orders as if the buyer had asked for it, then off the buyer's
 * route once the cookie landed — which is how a correct request ended up on the
 * action center. Waiting for the real persona also keeps the server and the
 * first client render in agreement, so there is no hydration mismatch.
 */
function SeatGuard({ children }: { children: ReactNode }) {
  const { persona, setPersona } = usePersona();
  const pathname = usePathname();
  const router = useRouter();

  /* What the last pass saw, so the guard can tell WHICH of the two changed. */
  const previous = useRef<{ seat: Persona; pathname: string } | null>(null);

  useEffect(() => {
    /* The cookie, not the context, decides. On the first client pass the context
       still holds the server's guess — reading the cookie here is the only way
       to judge the route against the seat that actually asked for it. */
    const seat = clientReadPersona() ?? persona;
    const before = previous.current;
    previous.current = { seat, pathname };

    if (activeEntry(seat, pathname) !== undefined) return;

    /* Which way the mismatch happened decides how to settle it, and getting this
       wrong made the seat switcher stop working: adopting the page's owner
       unconditionally meant switching to Christy while standing on a purchase
       order immediately switched back to Mercer, because the PO is Mercer's. The
       person had asked to change seats and the guard kept answering a different
       question. */
    if (before && before.seat !== seat) {
      /* They changed seats. Take them to that seat rather than dragging them
         back to the page they were leaving. */
      router.replace(PERSONAS[seat].route);
      return;
    }

    /* The PATH moved to somebody else's page — a link across a seat boundary.
       Follow the reader: a coordinator who clicks the sales order a load is
       carrying has asked to look at the service seat's record, and answering that
       with a bounce back to their own queue made every cross-seat link in the app
       look broken. Switching the seat is what the top bar would have done, and it
       leaves the rail, the agent panel and the record agreeing about whose screen
       this is. */
    const owner = seatOwning(pathname);
    if (owner) {
      setPersona(owner);
      return;
    }

    /* Nobody's page. Now a bounce is the right answer. */
    router.replace(PERSONAS[seat].route);
  }, [persona, pathname, router, setPersona]);

  /* Rendered unconditionally: gating on `persona` would blank the page on the
     server (which guesses "buyer") and then fill it on the client, which is a
     hydration mismatch. The redirect above fires on the first client effect, so
     a wrong-seat page is visible for at most one frame. */
  return <>{children}</>;
}

/**
 * The door has to have been opened.
 *
 * The session is a cookie the client reads, so — like the seat above — it is
 * judged after mount. Nothing renders until then: the server cannot know who is
 * signed in, and painting the portal for a frame before sending somebody to the
 * login page would show them exactly the thing the page exists to gate.
 */
function SessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (clientReadSession()) {
      setReady(true);
    } else {
      router.replace("/");
    }
  }, [router]);

  return ready ? <>{children}</> : null;
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  /* Expansion is held here so the top bar's toggle and the panel's own
     collapse/backdrop stay in sync — the rail is always visible, the panel
     overlays. */
  const [navExpanded, setNavExpanded] = useState(false);

  return (
    <PersonaProvider>
      {/* Above the seat, because the plant in scope is the same question on every
          screen — see PlantScopeContext. */}
      <ScopeProvider>
      <ChatPanelProvider>
      {/* One peek panel for the whole app — see ProductPeekContext. Six tables
          each owning their own would be six panels that can disagree about
          what is open.
          INSIDE the chat provider, because the panel's actions hand work to the
          agent: Approve starts a run, the star asks Iris for a reason. Mounted
          above it, `useChatPanel` had no context and opening a peek threw. */}
      <ProductPeekProvider>
        <SessionGuard>
        <div className="flex h-screen w-screen overflow-hidden">
          <Sidebar expanded={navExpanded} onExpandedChange={setNavExpanded} />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <TopBar onToggleNav={() => setNavExpanded((v) => !v)} />

            <div className="relative min-h-0 flex-1" style={{ background: "var(--gradient-page-bg)" }}>
              <div className="hide-scrollbar h-full overflow-y-auto">
                <div
                  className="flex min-h-full flex-col gap-6 px-[16px] py-6 md:px-[24px]"
                  style={{ maxWidth: 1648, marginLeft: "auto", marginRight: "auto" }}
                >
                  <SeatGuard>{children}</SeatGuard>
                </div>
              </div>
            </div>
          </div>

          {/* Docked to the right edge of the page — the design's border sits on
              its left, facing the content. */}
          <ChatPanel />
        </div>
        </SessionGuard>
      </ProductPeekProvider>
      </ChatPanelProvider>
      </ScopeProvider>
    </PersonaProvider>
  );
}
