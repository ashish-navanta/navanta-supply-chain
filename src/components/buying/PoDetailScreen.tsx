"use client";

import { useMemo, useState } from "react";
import {
  CalendarBlank,
  ChatsCircle,
  Clock,
  ClockCounterClockwise,
  CurrencyDollar,
  Factory,
  Hash,
  Notepad,
  Package,
  Phone,
  Receipt,
  User,
  Warning,
} from "@phosphor-icons/react";
import { AiStar, TableShell } from "@navanta-ai/design-system";
import { usePersona } from "@/context/PersonaContext";
import { PERSONAS } from "@/types/persona";
import { useChatPanel } from "@/context/ChatPanelContext";
import { StatusStepper, stagesToSteps } from "@/components/ui/StatusStepper";
import { AgentBand } from "@/components/ui/AgentBand";
import {
  CARD_RADIUS,
  CARD_SHADOW,
  CardHeading,
  Field,
  FieldRow,
  RecordSection,
  SectionCard,
} from "@/components/ui/RecordCard";
import { ActivityHistory } from "@/components/chat/ActivityHistory";
import { EmailThread } from "@/components/chat/EmailThread";
import { LineItems } from "@/components/chat/LineItems";
import { SupplierDetails } from "@/components/chat/SupplierDetails";
import { agentTaskFor } from "@/data/agent-actions";
import { LEAD_TIME_REASONS, OverridePanel } from "@/components/chat/OverridePanel";
import { poDates, poStateCommitted, poStateFor } from "@/data/po-state";
import { useActioned } from "@/lib/actioned";
import { noticeFor } from "@/data/customer-notice";
import {
  CAUSE_LABEL,
  SLIP_DAYS,
  causeOf,
  contactFor,
  formatUsdFull,
  historyFor,
  linesFor,
  shiftDate,
  threadFor,
  type ActionRow,
} from "@/data/action-center";

/**
 * One purchase order, laid out the way a account order is.
 *
 * Everything the review modal held is here — the agent's read, the figures the
 * decision turns on, and the five supporting panels — but as a route rather
 * than a sheet. The argument is the same one the order page makes: a PO is what
 * a supplier call is about, and a call runs long. A modal asks the reader to
 * hold the queue behind it in their head; a link can be pasted to the planner
 * who has to live with the date.
 *
 * The decision itself does not live here. Committing a lead time runs in the
 * chat panel now — the queue's own button starts it there, and duplicating the
 * confirm on this page would leave two places to do one thing, disagreeing the
 * moment one of them is worked and the other is not.
 */

/* The record itself lives in the right rail, where a reader glances at it
   while working the left. What stays in tabs is the evidence — the exchange,
   the breakdown, the trail — which is read one at a time and at length. */
const TABS = [
  { id: "products", label: "Products", icon: Package },
  { id: "thread", label: "Email & call thread", icon: ChatsCircle },
  { id: "history", label: "Activity history", icon: ClockCounterClockwise },
  /* Last, because it is the only tab that is pure reference. The other four are
     the work — what is on the order, what was said, what has happened, who is
     waiting — and a contact card sitting second pushed all of that right. */
  { id: "supplier", label: "Vendor details", icon: Factory },
] as const;

type Panel = (typeof TABS)[number]["id"];

/**
 * A name in the rail that opens the panel holding its record.
 *
 * The vendor already has a full account on this page in the supplier card, so
 * the link does not need a route to be a real link. It needs to stop the reader
 * hunting through the tabs for the thing they just clicked on.
 *
 * A button rather than an anchor: it changes what this page is showing, and an
 * `href` that goes nowhere would offer a middle-click that opens a blank tab.
 */
function PanelLink({
  children,
  onOpen,
  title,
}: {
  children: React.ReactNode;
  onOpen: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      className="min-w-0 truncate text-left hover:underline"
      style={{ color: "var(--link-color)", font: "inherit" }}
    >
      {children}
    </button>
  );
}

export function PoDetailScreen({ row }: { row: ActionRow }) {
  const { persona } = usePersona();
  const agent = PERSONAS[persona].agent;
  const { startTask } = useChatPanel();

  /* What is on the order opens first. The exchange and the trail explain how
     it got here; the lines are what "here" is made of. */
  const [panel, setPanel] = useState<Panel>("products");
  const [q, setQ] = useState("");
  /* The override is a deliberate act, not an always-open field: the default
     path is confirming the agent's figure, and a form standing open next to a
     recommendation reads as a doubt the page is casting on its own advice. */
  const [overriding, setOverriding] = useState(false);
  const [lead, setLead] = useState("");
  const [reason, setReason] = useState<string | null>(null);

  const lines = useMemo(() => linesFor(row), [row]);
  const thread = useMemo(() => threadFor(row, agent), [row, agent]);
  const history = useMemo(() => historyFor(row, agent), [row, agent]);
  const contact = contactFor(row.party, row.partyOwn);

  /* The row as it now stands, not as the fixture left it. Once a run lands, the
     store re-states the line as settled with the agent's own words for what it
     did — and this page has to show that, or the reader commits 42 days, watches
     the panel report it, and comes back to a page still asking them to commit
     42 days. */
  const actioned = useActioned();
  const [current] = actioned.live([row]);
  const done = current.state === "settled" && row.state !== "settled";

  /* The lead time the supplier is asking for, and what it was. Read off the
     lines rather than stored, the same way the modal read it — the lines ARE
     the +10d story, so a second copy of the figure could only ever be a way for
     the two to disagree. */
  const leadOnRecord = Math.max(...lines.map((l) => l.leadDays));
  const wasLead = leadOnRecord - SLIP_DAYS;
  const moved = row.signal === "lead-time-jump" || row.signal === "capacity";
  const committedDate = row.committedOn ?? (moved ? shiftDate(row.date, -SLIP_DAYS) : row.date);

  /* Committed, the track shows the write landing rather than a decision pending
     — the same state the run's own card shows in the panel, from the same
     function, so the two cannot disagree about what was written. */
  const track = done
    ? poStateCommitted(row, leadOnRecord)
    : poStateFor(row, contact.name);
  const task = agentTaskFor(current);

  /* Whether the accounts behind this PO have actually been told. Read from the
     service seat, not asserted here — the buyer can write a date to the
     supplier record on their own but cannot have had that conversation. */
  const notice = moved ? noticeFor(row) : null;

  /* The lines sum exactly to the row by construction, so the item total is the
     exposure rather than a second figure that could drift from it. Freight and
     tax sit on top at the same rates the order page uses — one set of rates
     across both seats, since it is the same freight. */
  const itemTotal = row.value;
  const freight = Math.round(itemTotal * 0.025);
  const tax = Math.round(itemTotal * 0.075);
  const total = itemTotal + freight + tax;

  /* One count per panel, so the tab badge and the shell's footer count cannot
     disagree about how many of a thing there are. */
  /* Explicit per tab, with no fall-through. The last branch used to be the
     accounts count, so "Vendor details" — which has no count — inherited it and
     wore a badge reading 1. A default that happens to be another tab's number is
     worse than no default. */
  const countFor = (id: Panel): number | undefined => {
    if (id === "products") return lines.length;
    if (id === "thread") return thread.length;
    if (id === "history") return history.length;
    return undefined;
  };
  const shownLines = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? lines.filter((l) => `${l.sku} ${l.name}`.toLowerCase().includes(needle)) : lines;
  }, [lines, q]);
  /* One paragraph, in the agent's voice: what happened, what it touches, and
     where the gap is. Composed from the row's own figures rather than authored,
     so it cannot drift from the cards around it — and written as prose because
     that is what a colleague would send, where a bulleted list of three facts
     reads as a form the reader has to parse. */
  /* The alert line is written without terminal punctuation because it is a
     banner heading elsewhere; joined into prose it needs a full stop or the two
     sentences run together. */
  const asSentence = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
  const summary = [
    asSentence(done ? current.insight : track.alert ?? row.insight),
    moved
      ? done
        ? `${leadOnRecord} days is on the ${row.partyOwn ? "plant" : "supplier"} record for the next three months, across ${row.qtyValue} ${row.qtyUnit} and ${formatUsdFull(row.value)}.`
        : `They are asking ${leadOnRecord} days against the ${wasLead} we planned on, across ${row.qtyValue} ${row.qtyUnit} and ${formatUsdFull(row.value)}. Nothing is on the record until you commit it.`
      : `${row.qtyValue} ${row.qtyUnit} and ${formatUsdFull(row.value)} on this line.`,
    notice
      ? notice.told
        ? `${notice.named} has been informed.`
        : `${notice.named} has not been told yet — that stays with ${notice.by}.`
      : "It holds for the next three months.",
  ].join(" ");

  /* How firm the figure is. A quote in writing beats a plant schedule the agent
     inferred, and the reader deserves to know which they are looking at. */
  const confidenceFor = (r: typeof row) =>
    r.signal === "lead-time-jump" ? 88 : r.signal === "capacity" ? 82 : 76;

  /* The figure being committed. The stepper starts on the agent's number, so an
     override is a departure from it rather than an empty field to fill. */
  const leadNum = Number.parseInt(lead || String(leadOnRecord), 10);
  const validLead = Number.isFinite(leadNum) && leadNum > 0 && leadNum < 400;
  const overrideTask =
    validLead && leadNum !== leadOnRecord && reason
      ? agentTaskFor(row, undefined, { days: leadNum, reason })
      : null;

  const closeOverride = () => {
    setOverriding(false);
    setReason(null);
    setLead("");
  };


  return (
    <div className="flex flex-col gap-3">
      {/* ── Header ── */}
      <div
        className="flex items-end justify-between"
        style={{ paddingLeft: 4, paddingRight: 4, marginBottom: 8 }}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Receipt size={20} weight="duotone" className="shrink-0" style={{ color: "var(--color-iris-700)" }} />
            <h1 style={{ fontSize: 20, fontWeight: 600, lineHeight: "144%", color: "#212121" }}>
              {row.ref}
            </h1>
            {/* No pills. The state and the cause are both said better further
                down — the stepper shows where the line is and the agent's band
                names the cause in a sentence — and a badge that restates a card
                a hand's width below it is decoration. */}
          </div>
          <p
            className="whitespace-nowrap font-medium"
            style={{ fontSize: 14, lineHeight: 1.5, color: "#333" }}
          >
            {`${row.refSub} · ${row.party}`}
          </p>
        </div>
      </div>

      {/* One grid, two columns that each stack their own cards. Two stacked
          grids put PO details on a second row, which left a column of empty
          page between it and the summary it continues — the right-hand rail is
          one reading, so it is one column. `align-start` so each card is as
          tall as its own content rather than as tall as its neighbour. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          columnGap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ gridColumn: "span 8" }} className="flex min-w-0 flex-col gap-5">
          <StatusStepper
            className="flex-1"
            title="PO Status"
            icon={Receipt}
            /* Dates on every stage: what happened, and when the rest is due.
               A stepper without them answers "how far" and leaves "by when" to
               a different card. */
            steps={stagesToSteps(track.stages, {
              count: lines.length,
              dates: poDates(row, wasLead),
            })}
            totalItems={lines.length}
          >
            <div className="flex w-full flex-col gap-3 px-4 pb-4">
              {/* Where the line is, what is wrong with it, and what to do —
                  one card. Three of them said this in three voices, and the
                  reader had to stitch them together to get one decision. */}
              {task ? (
                <AgentBand
                  agent={agent}
                  summary={summary}
                  meta={
                    /* Nothing is on the record until the buyer commits, so the
                       line states both dates and which is which. It used to
                       read "Revised ETA: 2 Sep (was 23 Aug)" before anyone had
                       pressed anything — reporting the supplier's ask as though
                       it were already written, which is exactly the confusion
                       the confirm exists to prevent. */
                    <span
                      className="flex flex-wrap items-center gap-1"
                      style={{ fontSize: 14, lineHeight: "22px", color: "#18181B" }}
                    >
                      {!done && committedDate && committedDate !== track.eta ? (
                        <>
                          <span>On the record:</span>
                          <span className="font-medium">{committedDate}</span>
                          <span style={{ color: "#71767A" }}>
                            {`— committing ${leadOnRecord} days moves it to`}
                          </span>
                          <span className="font-medium" style={{ color: "#DE1010" }}>
                            {track.eta}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>{`${track.etaLabel} date:`}</span>
                          <span
                            className="font-medium"
                            style={{ color: track.etaLate ? "#DE1010" : undefined }}
                          >
                            {track.eta}
                          </span>
                        </>
                      )}
                    </span>
                  }
                  confidencePct={confidenceFor(row)}
                  actionLine={task.ask}
                  confirmLabel={task.label}
                  onConfirm={() => startTask(task)}
                  override={{
                    label: "Override lead time",
                    open: overriding,
                    onOpen: () => {
                      setLead(String(leadOnRecord));
                      setOverriding(true);
                    },
                    panel: (
                      <OverridePanel
                        agent={agent}
                        subject="lead time"
                        unit="days"
                        reasons={LEAD_TIME_REASONS}
                        value={lead}
                        onValueChange={setLead}
                        recommended={leadOnRecord}
                        reason={reason}
                        onReasonChange={setReason}
                        valid={validLead}
                        onCancel={closeOverride}
                        onConfirm={() => {
                          /* The run carries the buyer's figure and their reason
                             all the way through — steps, write and report all
                             name it, so nobody downstream reads a number the
                             supplier never quoted and assumes they did. */
                          startTask(overrideTask ?? task);
                          closeOverride();
                        }}
                      />
                    ),
                  }}
                />
              ) : (
                <div
                  className="flex w-full flex-col gap-1 rounded-[12px] p-3"
                  style={{ background: "#F5EFFF" }}
                >
                  <span className="flex items-center gap-2">
                    <AiStar size={16} variant="small" />
                    <span
                      className="font-medium"
                      style={{ fontSize: 14, lineHeight: "22px", color: "#181A1B" }}
                    >
                      {`${agent} Summary`}
                    </span>
                  </span>
                  <p className="px-1" style={{ fontSize: 14, lineHeight: "22px", color: "#18181B" }}>
                    {done ? current.insight : summary}
                  </p>
                </div>
              )}
            </div>
          </StatusStepper>

          {/* The DS shell rather than a card with a tab bar drawn on it. The
              tabs, the title and the count are one component's job — and the
              queue this record came from is drawn by the same shell, so the
              two surfaces sit at the same weight instead of the record reading
              as a lighter thing than the list. */}
          <TableShell
            /* One name, held across the tabs. Retitling the shell to whichever
               panel is open made the heading a second, larger copy of the
               selected tab — and the thing on screen never actually changed:
               it is this purchase order, seen four ways. */
            title="PO record"
            icon={Receipt}
            customize={false}
            tabs={TABS.map((t) => ({
              id: t.id,
              label: t.label,
              icon: t.icon,
              badge: countFor(t.id),
            }))}
            activeTab={panel}
            onTabChange={(id) => setPanel(id as Panel)}
            totalItems={panel === "products" ? shownLines.length : (countFor(panel) ?? 0)}
            currentPage={1}
            onPageChange={() => {}}
            pageSize={25}
            onPageSizeChange={() => {}}
            /* Search where there is a list to search. The thread, the trail and
               the accounts are short and already in the order they happened —
               a search field over four items is furniture. */
            searchValue={panel === "products" ? q : undefined}
            onSearchChange={panel === "products" ? setQ : undefined}
            searchPlaceholder="Search SKU or colourway"
            isFiltered={panel === "products" && q.trim().length > 0}
            /* And a pager only where paging could ever happen. The DS renders
               its footer unconditionally, so the other three panels suppress
               it rather than showing "1–4 of 4" under a list of four. */
            className={panel === "products" ? "ts-search-below ts-scroll-tabs" : "ts-no-pager ts-scroll-tabs"}
          >
            {panel === "supplier" ? (
              <div className="p-4">
                <SupplierDetails row={row} />
              </div>
            ) : panel === "history" ? (
              <div className="p-4">
                <ActivityHistory row={row} agent={agent} />
              </div>
            ) : panel === "thread" ? (
              <div className="p-4">
                <EmailThread row={row} agent={agent} />
              </div>
            ) : (
              <LineItems row={row} query={q} />
            )}
          </TableShell>
        </div>

        <div style={{ gridColumn: "span 4" }} className="flex flex-col gap-5">
          <div
            className="flex flex-col overflow-hidden bg-[var(--surface-base)]"
            style={{ borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW }}
          >
            <CardHeading icon={CurrencyDollar}>PO Summary</CardHeading>
            <div className="flex flex-col gap-3 p-[16px] pt-0">
              <div className="flex flex-col gap-[19px]">
              {[
                ["Item total", formatUsdFull(itemTotal)],
                ["Freight charges", formatUsdFull(freight)],
                ["Discount added", "$0"],
                ["Estimated tax", formatUsdFull(tax)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between whitespace-nowrap text-[14px] leading-[1.5]"
                >
                  <span className="text-[#71717a]">{label}</span>
                  <span className="text-right font-medium text-[#18181b]">{value}</span>
                </div>
                ))}
              </div>
              <div className="flex items-center justify-between whitespace-nowrap border-t border-[#e4e4e7] pt-[16px] text-right text-[14px] font-semibold leading-[1.33] text-[#212121]">
                <span>Total</span>
                <span>{formatUsdFull(total)}</span>
              </div>
              <div className="flex items-center justify-between whitespace-nowrap text-[14px]">
                <span className="leading-[1.5] text-[#71717a]">Payment terms</span>
                <span className="text-right font-medium leading-[1.5] text-[#212121]">
                  {row.partyOwn ? "Internal transfer" : "Net 60"}
                </span>
              </div>
            </div>
          </div>

          {/* PO Information on the same structure as the order page's — grey
              band sections, label-over-value two to a row, copy on the
              references somebody retypes. Two record pages in one app should not
              lay out their facts two different ways. */}
          <SectionCard title="PO Information" icon={Receipt}>
            <div className="flex flex-col gap-2 px-3 py-2">
              <RecordSection icon={Notepad} title="Order identity">
                <FieldRow>
                  <Field icon={Hash} label="PO number" copy={row.ref}>
                    {row.ref}
                  </Field>
                  <Field icon={Warning} label="Cause">
                    {CAUSE_LABEL[causeOf(row.signal)]}
                  </Field>
                </FieldRow>
                <FieldRow last>
                  <Field
                    icon={CalendarBlank}
                    label={done ? "Committed date" : row.state === "waiting" ? "Asked" : "Promise date"}
                    tone={!done && committedDate !== row.date ? "danger" : undefined}
                  >
                    {done
                      ? `${row.date}${committedDate && committedDate !== row.date ? ` · was ${committedDate}` : ""}`
                      : (committedDate ?? row.date)}
                  </Field>
                </FieldRow>
              </RecordSection>

              <RecordSection icon={Factory} title="Vendor details">
                <FieldRow>
                  <Field icon={Factory} label={row.partyOwn ? "Plant" : "Vendor"} copy={row.party}>
                    <PanelLink
                      onOpen={() => setPanel("supplier")}
                      title={`Open ${row.party}'s supplier record`}
                    >
                      {row.party}
                    </PanelLink>
                  </Field>
                  {/* What the record says today. The old figure belongs to the
                      run that changed it — the agent band and the history tab
                      both carry it with the reason attached, which is where a
                      reader can do something with it. Here it was a number
                      beside a number, and the field is meant to answer "how
                      long is this vendor now". */}
                  <Field icon={Clock} label="Lead time">{`${leadOnRecord} days`}</Field>
                </FieldRow>
                <FieldRow last>
                  <Field icon={User} label="Contact">
                    <span className="truncate">{contact.name}</span>
                  </Field>
                  <Field icon={Phone} label="Phone" copy={contact.phone}>
                    {contact.phone}
                  </Field>
                </FieldRow>
              </RecordSection>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
