"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  Barcode,
  CalendarBlank,
  Camera,
  ClipboardText,
  ClockCounterClockwise,
  CurrencyDollar,
  Hash,
  Notepad,
  Package,
  Receipt,
  ShieldCheck,
  Storefront,
  Truck,
  User,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Button,
  DataTable,
  KToastContainer,
  Pill,
  TableShell,
  Toast,
  type DataTableColumn,
  type DataTableSlotColumn,
} from "@navanta-ai/design-system";
import { PERSONAS } from "@/types/persona";
import { SERVICE_ROUTES, orderRoute } from "@/data/nav";
import { daysFromToday, formatUsdFull, historyFor } from "@/data/action-center";
import { agentTaskFor } from "@/data/agent-actions";
import { useChatPanel } from "@/context/ChatPanelContext";
import { ActivityHistory } from "@/components/chat/ActivityHistory";
import { ClaimModal } from "@/components/chat/ClaimModal";
import type { CommitReport } from "@/components/chat/commit";
import { AgentBand } from "@/components/ui/AgentBand";
import { SHAW_TABLE_PROPS } from "@/components/ui/tableTheme";
import { StatusStepper, type StepperStep } from "@/components/ui/StatusStepper";
import {
  CARD_RADIUS,
  CARD_SHADOW,
  CardHeading,
  Field,
  FieldRow,
  HAIR,
  RecordSection,
  SectionCard,
} from "@/components/ui/RecordCard";
import {
  CLAIM_KIND_LABEL,
  CLAIM_RUN,
  CLAIM_STAGE_LABEL,
  CLAIM_TYPES,
  claimAsRow,
  claimRunDates,
  claimRunPosition,
  dealerByName,
  orderById,
  orderLines,
  type ServiceClaim,
} from "@/data/service";

/**
 * One claim, in full.
 *
 * The same page the purchase order and the account order already are — stepper
 * with the agent's read inside it, the evidence in tabs, the record in the right
 * rail — because a claim is the third record in this app that a person opens to
 * answer "what happened and what do I owe". It was the only one still living
 * exclusively in a modal, which meant a claim could not be linked to, and a
 * $16,000 credit decision had to be held in the reader's head behind a sheet.
 *
 * What is different is what the money means. An order's ladder adds freight and
 * tax up to a total somebody pays; a claim's runs the other way — the account
 * asked for one figure, Christy adjudicated another from the records, and policy
 * decides whether one signature is enough. That ladder IS the decision, so it
 * leads the rail.
 *
 * The decision runs through the same review sheet the claims list opens, not a
 * second one built for this page. That sheet is where the override and the policy
 * cap live, and two surfaces that can both release the same money would disagree
 * the moment either was used. What the page adds is everything around the
 * decision: what it rests on, and what it is worth.
 */

const TABS = [
  { id: "lines", label: "Products claimed", icon: Package },
  { id: "evidence", label: "Evidence", icon: Camera },
  { id: "history", label: "Activity history", icon: ClockCounterClockwise },
] as const;

type Panel = (typeof TABS)[number]["id"];

const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** A claimed line: the order's own line, with what is being claimed against it. */
interface ClaimedLine {
  sku: string;
  style: string;
  dyeLot: string;
  delivered: number;
  claimed: number;
  unitValue: number;
}

/**
 * What the claim is actually against.
 *
 * Read off the order rather than stored on the claim, so the SKU, the batch
 * and the price a credit is computed from are the delivery's own figures. A
 * claim that carried its own copy of them could be adjudicated against a price
 * the order does not have.
 */
function claimedLines(claim: ServiceClaim): ClaimedLine[] {
  const order = orderById(claim.orderId);
  if (!order) return [];
  const lines = orderLines(order).filter((l) => l.style === claim.style);
  const pool = lines.length ? lines : orderLines(order);
  /* The order's own rate, not the derived line's. `orderLines` splits a style
     into its variants and each carries a variant price, so multiplying those out
     came to $2,348 against a claim adjudicated at $2,380 — a $32 disagreement
     between a table and the credit above it, on the same page, about the same two
     units. The claim's money comes from `order.value / order.units`, so the
     lines have to be priced the same way or one of them is wrong. */
  const rate = Math.round(order.value / order.units);
  /* Spread the claimed units across the matching lines biggest-first, which is
     how a warehouse would find them: the claim says "two units of Diffuse Color"
     and the line with the most of it is where they came from. */
  let left = claim.units;
  return pool
    .slice()
    .sort((a, b) => b.units - a.units)
    .map((l) => {
      const claimed = Math.min(left, l.units);
      left -= claimed;
      return {
        sku: l.sku,
        style: l.style,
        dyeLot: l.dyeLot,
        delivered: l.units,
        claimed,
        unitValue: rate,
      };
    })
    .filter((l) => l.claimed > 0);
}

function stepsFor(claim: ServiceClaim): StepperStep[] {
  const { reached, failed } = claimRunPosition(claim);
  const dates = claimRunDates(claim);
  return CLAIM_RUN.map((label, i) => {
    const status =
      i < reached ? "completed" : i === reached ? (failed ? "error" : "active") : "pending";
    return {
      label,
      status,
      /* Nothing dated ahead of where the claim has got to — a date under a
         pending node reads as a fact that has already happened. */
      date: status === "pending" ? undefined : dates[label],
    };
  });
}

export function ClaimDetailScreen({ claim }: { claim: ServiceClaim }) {
  const [panel, setPanel] = useState<Panel>("lines");
  /* The review sheet, and the notification it leaves behind. */
  const [review, setReview] = useState(false);
  const [toast, setToast] = useState<CommitReport | null>(null);
  const { startTask } = useChatPanel();

  const agent = PERSONAS.csr.agent;
  const order = orderById(claim.orderId);
  const account = dealerByName(claim.account);
  const kind = CLAIM_TYPES.find((t) => t.id === claim.kind);

  /* One projection, shared with the review modal and the trail — see
     `claimAsRow`. The band's task and the history both read this, so the page
     cannot offer an action the modal would then describe differently. */
  const row = useMemo(() => claimAsRow(claim), [claim]);
  const task = agentTaskFor(row);
  const history = useMemo(() => historyFor(row, agent), [row, agent]);
  const lines = useMemo(() => claimedLines(claim), [claim]);

  const credit = claim.adjudicated ?? claim.requested;
  const overCap = credit > claim.policyCap;
  const decided = claim.adjudicated !== null;
  const settled = claim.stage === "settled";
  const declined = claim.stage === "declined";

  /* The paragraph in Christy's voice. Says what she worked the figure out FROM,
     because that is the whole of why a rep can release it without rebuilding the
     case: the order, the receipt and the photographs are already on file. */
  const summary = settled
    ? `Settled. The ${formatUsdFull(credit)} credit was issued against ${claim.receipt}, the invoice corrected and ${claim.account} made whole.`
    : declined
      ? `Declined. ${claim.rootCause ?? "The records do not support the claim"} — ${claim.account} has been told, with the receipt and the photographs attached so they can dispute it if they hold something we do not.`
      : decided
        ? `I built this from ${claim.orderId}, delivery receipt ${claim.receipt} and ${claim.photos} photograph${claim.photos === 1 ? "" : "s"} taken at the tailgate, and adjudicated ${formatUsdFull(credit)} against ${claim.units} damaged unit${claim.units === 1 ? "" : "s"} of ${claim.style}. ${
            overCap
              ? `That is over the ${formatUsdFull(claim.policyCap)} policy limit, so it needs a second signature as well as yours.`
              : `It sits inside the ${formatUsdFull(claim.policyCap)} policy limit. What is left is releasing it.`
          }`
        : `${claim.account} has asked for ${formatUsdFull(claim.requested)} against ${claim.units} unit${claim.units === 1 ? "" : "s"} of ${claim.style}. I have the order and the receipt; ${claim.photos ? `${claim.photos} photographs are on file` : "no photographs are on file yet"}, and I am checking them against the delivery before putting a figure to it.`;

  const meta = (
    <span className="flex flex-wrap items-center" style={{ gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: "#181A1B" }}>
        {decided ? `Adjudicated ${formatUsdFull(credit)}` : `Requested ${formatUsdFull(claim.requested)}`}
      </span>
      <span style={{ fontSize: 13, color: "#71767A" }}>
        {`· filed ${claim.openedOn} · ${CLAIM_KIND_LABEL[claim.kind]}`}
      </span>
      {kind && (
        <span style={{ fontSize: 13, color: "#71767A" }}>
          {`· ${kind.windowDays}-day window`}
        </span>
      )}
    </span>
  );

  const serialSlot: DataTableSlotColumn<ClaimedLine> = {
    id: "sn",
    width: 44,
    header: () => (
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-primary)" }}>#</span>
    ),
    cell: (_l, ctx) => (
      <span style={{ fontSize: 13, color: "var(--ds-text-secondary)", ...numeric }}>
        {ctx.index + 1}
      </span>
    ),
  };

  const columns: DataTableColumn<ClaimedLine>[] = [
    {
      key: "sku",
      label: "Product SKU",
      minWidth: 190,
      cell: (l) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)", ...numeric }}>
            {l.sku}
          </span>
          <span className="truncate" style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
            {l.style}
          </span>
        </span>
      ),
    },
    {
      key: "dyeLot",
      label: "Batch",
      minWidth: 100,
      cell: (l) => (
        <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>{l.dyeLot}</span>
      ),
    },
    {
      key: "claimed",
      label: "Claimed",
      minWidth: 96,
      /* Against what was delivered. "2 units" alone does not say whether the
         whole line failed or a corner of it, and that is the first thing anybody
         adjudicating asks. */
      cell: (l) => (
        <span className="flex min-w-0 flex-col" style={{ gap: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)", ...numeric }}>
            {`${l.claimed} of ${l.delivered}`}
          </span>
          <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>units</span>
        </span>
      ),
    },
    {
      key: "unitValue",
      label: "Per unit",
      minWidth: 104,
      cell: (l) => (
        <span style={{ fontSize: 14, color: "var(--ds-text-primary)", ...numeric }}>
          {formatUsdFull(l.unitValue)}
        </span>
      ),
    },
    {
      key: "value",
      label: "Claimed value",
      minWidth: 120,
      cell: (l) => (
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)", ...numeric }}>
          {formatUsdFull(l.claimed * l.unitValue)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      minWidth: 118,
      cell: () => (
        <span style={{ fontSize: 13, color: "var(--ds-text-secondary)" }}>
          {CLAIM_STAGE_LABEL[claim.stage]}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header ── */}
      <div
        className="flex items-end justify-between"
        style={{ paddingLeft: 4, paddingRight: 4, marginBottom: 8 }}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ClipboardText
              size={20}
              weight="duotone"
              className="shrink-0"
              style={{ color: "var(--color-iris-700)" }}
            />
            <h1 style={{ fontSize: 20, fontWeight: 600, lineHeight: "144%", color: "#212121" }}>
              {claim.id}
            </h1>
            {/* The one badge worth wearing up here: over the cap is not a state
                of the claim, it is a fact about who has to sign it, and it is
                the reason the page might not finish in this reader's hands. */}
            {overCap && !settled && (
              <Pill variant="warning" size="sm">
                Over policy cap
              </Pill>
            )}
          </div>
          <p
            className="font-medium"
            style={{ fontSize: 14, lineHeight: 1.5, color: "#333" }}
          >
            {`Filed ${claim.openedOn} · ${claim.account} · against ${claim.orderId}`}
          </p>
        </div>
        <div className="ml-4 flex items-center gap-2">
          <Link href={orderRoute(claim.orderId)}>
            <Button size="sm" variant="secondary" iconLeft={<Package size={14} weight="bold" />}>
              Open order
            </Button>
          </Link>
          <Link href={SERVICE_ROUTES.accounts}>
            <Button size="sm" variant="secondary" iconLeft={<Storefront size={14} weight="bold" />}>
              Account record
            </Button>
          </Link>
        </div>
      </div>

      {/* One grid, two columns that each stack their own cards — the same layout
          as the purchase order and the account order, so a reader moving between
          the three records finds the same things in the same places. */}
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
            title="Claim status"
            icon={ClipboardText}
            steps={stepsFor(claim)}
            /* Products, which is what the stepper's counter is labelled. The
               unit count read as "2 Items" beside a single claimed SKU. */
            totalItems={lines.length}
          >
            <div className="flex w-full flex-col gap-3 px-4 pb-4">
              {task ? (
                <AgentBand
                  agent={agent}
                  summary={summary}
                  meta={meta}
                  /* The money, not the lot. `agentTaskFor` offers the dye-lot
                     escalation on an adjudicated claim, which is the right lead
                     in a QUEUE — the credit is one signature and the pattern is
                     the real work. On the claim's own record it is the wrong way
                     round: this page exists to answer "do I owe this", and an
                     action bar that cannot release the credit sends the reader
                     back to the list to do it. So the credit leads and the lot
                     follows, still through the agent, still one task. */
                  actionLine={
                    decided
                      ? `Issue a ${formatUsdFull(credit)} credit to ${claim.account}`
                      : `Check ${agent}'s working before a figure is put to it`
                  }
                  confirmLabel={decided ? `Approve ${formatUsdFull(credit)}` : "Review claim"}
                  onConfirm={() => setReview(true)}
                  secondary={
                    <Button
                      size="sm"
                      variant="secondary"
                      iconLeft={<Barcode size={14} weight="bold" />}
                      onClick={() => startTask(task)}
                    >
                      {task.label}
                    </Button>
                  }
                />
              ) : (
                /* Settled and declined take the same band without a footer: the
                   argument is still worth reading — it is the record of why the
                   money moved — but there is nothing left to press. */
                <div
                  className="flex w-full flex-col gap-2 rounded-[12px] p-3"
                  style={{ background: "#F5EFFF" }}
                >
                  <span className="flex items-center gap-2">
                    <ClipboardText size={16} weight="duotone" style={{ color: "#59349C" }} />
                    <span
                      className="font-medium"
                      style={{ fontSize: 14, lineHeight: "22px", color: "#181A1B" }}
                    >
                      {`${agent} Summary`}
                    </span>
                  </span>
                  <p className="px-1" style={{ fontSize: 14, lineHeight: "22px", color: "#18181B" }}>
                    {summary}
                  </p>
                  <div className="px-1">{meta}</div>
                </div>
              )}
            </div>
          </StatusStepper>

          <TableShell
            title="Claim record"
            icon={ClipboardText}
            customize={false}
            tabs={TABS.map((t) => ({
              id: t.id,
              label: t.label,
              icon: t.icon,
              badge:
                t.id === "lines"
                  ? lines.length
                  : t.id === "evidence"
                    ? claim.photos || undefined
                    : t.id === "history"
                      ? history.length || undefined
                      : undefined,
            }))}
            activeTab={panel}
            onTabChange={(next) => setPanel(next as Panel)}
            /* No pager on any of the three: the claimed lines, the evidence and
               the trail are all short and already in the order they happened. */
            totalItems={0}
            currentPage={1}
            onPageChange={() => {}}
            pageSize={10}
            onPageSizeChange={() => {}}
            className="ts-no-pager ts-scroll-tabs"
          >
            {panel === "lines" ? (
              <DataTable<ClaimedLine>
                {...SHAW_TABLE_PROPS}
                data={lines}
                columns={columns}
                leadingSlots={[serialSlot]}
                rowKey={(l) => l.sku}
              />
            ) : panel === "evidence" ? (
              <Evidence claim={claim} deliveredOn={order?.deliveredOn} />
            ) : (
              <div className="p-4">
                <ActivityHistory row={row} agent={agent} />
              </div>
            )}
          </TableShell>
        </div>

        <div style={{ gridColumn: "span 4" }} className="flex flex-col gap-5">
          {/* The money, as the decision rather than as a bill. What was asked,
              what the records support, and what policy lets this reader release
              on their own signature — in that order, because that is the order
              the question gets answered in. */}
          <div
            className="flex flex-col overflow-hidden bg-[var(--surface-base)]"
            style={{ borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW }}
          >
            <CardHeading icon={CurrencyDollar}>Claim summary</CardHeading>
            <div className="flex flex-col gap-3 p-[16px] pt-0">
              <div className="flex flex-col gap-[19px]">
                {[
                  ["Requested by account", formatUsdFull(claim.requested)],
                  [
                    "Adjudicated",
                    decided ? formatUsdFull(claim.adjudicated ?? 0) : "Not yet assessed",
                  ],
                  [
                    "Difference",
                    decided
                      ? claim.requested === credit
                        ? "None"
                        : `−${formatUsdFull(claim.requested - credit)}`
                      : "—",
                  ],
                  ["Policy limit", formatUsdFull(claim.policyCap)],
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
                <span>{settled ? "Credit issued" : "Credit to issue"}</span>
                <span>{declined ? "None" : formatUsdFull(credit)}</span>
              </div>
              <div className="flex items-center justify-between whitespace-nowrap text-[14px]">
                <span className="leading-[1.5] text-[#71717a]">Signature</span>
                <span
                  className="text-right font-medium leading-[1.5]"
                  style={{ color: overCap && !settled ? "#DE1010" : "#212121" }}
                >
                  {declined
                    ? "Not required"
                    : overCap
                      ? "Second signature needed"
                      : `${PERSONAS.csr.name} alone`}
                </span>
              </div>
            </div>
          </div>

          <SectionCard title="Claim Information" icon={ClipboardText}>
            <div className="flex flex-col gap-2 px-3 py-2">
              <RecordSection icon={Notepad} title="Claim identity">
                <FieldRow>
                  <Field icon={Hash} label="Claim number" copy={claim.id}>
                    {claim.id}
                  </Field>
                  <Field icon={CalendarBlank} label="Filed">
                    {claim.openedOn}
                  </Field>
                </FieldRow>
                <FieldRow last>
                  <Field icon={WarningCircle} label="Type">
                    <span className="truncate">{CLAIM_KIND_LABEL[claim.kind]}</span>
                  </Field>
                  <Field
                    icon={ShieldCheck}
                    label="Stage"
                    tone={declined ? "danger" : undefined}
                  >
                    {`${CLAIM_STAGE_LABEL[claim.stage]}${claim.decidedOn ? ` · ${claim.decidedOn}` : ""}`}
                  </Field>
                </FieldRow>
              </RecordSection>

              <RecordSection icon={Truck} title="Delivery">
                <FieldRow>
                  {/* The order, in a new tab. The rep is mid-adjudication and the
                      delivery is something they check, not somewhere they go. */}
                  <Field icon={Package} label="Filed against" copy={claim.orderId}>
                    <a
                      href={orderRoute(claim.orderId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${claim.orderId} in a new tab`}
                      className="flex min-w-0 items-center gap-1 hover:underline"
                      style={{ color: "var(--link-color)" }}
                    >
                      <span className="truncate">{claim.orderId}</span>
                      <ArrowSquareOut size={12} className="shrink-0" />
                    </a>
                  </Field>
                  <Field icon={Receipt} label="Goods receipt" copy={claim.receipt}>
                    {claim.receipt}
                  </Field>
                </FieldRow>
                <FieldRow last>
                  <Field icon={CalendarBlank} label="Delivered">
                    {order?.deliveredOn ?? "Not recorded"}
                  </Field>
                  <Field icon={Barcode} label="Batch" copy={claim.batch}>
                    {claim.batch}
                  </Field>
                </FieldRow>
              </RecordSection>

              <RecordSection icon={WarningCircle} title="Cause">
                <FieldRow>
                  <Field icon={Camera} label="Photographs">
                    {claim.photos ? `${claim.photos} on file` : "None yet"}
                  </Field>
                  <Field icon={Package} label="Claimed">
                    {`${claim.units} units`}
                  </Field>
                </FieldRow>
                <FieldRow last>
                  {/* No `truncate` on either. A root cause is a sentence and the
                      account's name is most of one; clipping them would hide the
                      part that says which fleet and which account. */}
                  <Field icon={WarningCircle} label="Root cause">
                    {claim.rootCause ?? "Under investigation"}
                  </Field>
                  <Field icon={User} label="Account">
                    {claim.account}
                  </Field>
                </FieldRow>
              </RecordSection>

              {/* The account as the credit's counterparty. Their claim rate is
                  the fact that changes how this one reads: a first claim from a
                  clean account and the fifth from a noisy one are the same
                  paperwork and different decisions. */}
              {account && (
                <RecordSection icon={Storefront} title="Account standing">
                  <FieldRow>
                    <Field icon={Storefront} label="Account">
                      <span className="truncate">{`${account.name} · ${account.tier}`}</span>
                    </Field>
                    <Field icon={Hash} label="Terms">
                      {account.paymentTerms}
                    </Field>
                  </FieldRow>
                  <FieldRow last>
                    <Field icon={ClipboardText} label="Claim rate">
                      {`${account.claimRate} per 100 orders`}
                    </Field>
                    <Field icon={Truck} label="On time">
                      {`${account.onTimePct}%`}
                    </Field>
                  </FieldRow>
                </RecordSection>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* The same sheet the claims list opens — see the note at the top. */}
      {review && (
        <ClaimModal
          row={row}
          agent={agent}
          signer={PERSONAS.csr.name}
          onClose={() => setReview(false)}
          onCommitted={(r) => {
            setReview(false);
            setToast(r);
          }}
        />
      )}

      {toast && (
        <KToastContainer position="top-right" className="z-[110]">
          <Toast
            type="success"
            className="transition-[opacity,translate,scale]"
            title={toast.title}
            message={toast.message}
            duration={8000}
            onClose={() => setToast(null)}
          />
        </KToastContainer>
      )}
    </div>
  );
}

/**
 * What the adjudication rests on.
 *
 * Not an attachment list. The reference portal shows filenames and sizes, which
 * tells a reader that a file exists and nothing about whether it settles
 * anything. What a rep releasing a credit needs is whether the evidence clears
 * the bar this claim type sets — photographs where the type demands them, a
 * receipt, a filing inside the window — so each line says what it proves and
 * whether it holds.
 */
/** Whether the claim was filed inside the window its type allows. */
function filingLine(
  claim: ServiceClaim,
  windowDays: number | undefined,
  deliveredOn?: string,
): { icon: typeof CalendarBlank; label: string; detail: string; ok: boolean } {
  const filed = daysFromToday(claim.openedOn);
  const delivered = deliveredOn ? daysFromToday(deliveredOn) : null;
  const gap = filed !== null && delivered !== null ? filed - delivered : null;
  const base = { icon: CalendarBlank, label: `Filed ${claim.openedOn}` };

  if (windowDays === undefined || gap === null || gap < 0) {
    return {
      ...base,
      detail: windowDays
        ? `This claim type allows ${windowDays} days from delivery.`
        : "On file.",
      ok: claim.stage !== "declined",
    };
  }
  const late = gap > windowDays;
  return {
    ...base,
    detail: late
      ? `${gap} days after delivery — outside the ${windowDays}-day window this claim type allows, which is on its own enough to decline it.`
      : `${gap} day${gap === 1 ? "" : "s"} after delivery, inside the ${windowDays}-day window this claim type allows.`,
    ok: !late,
  };
}

function Evidence({ claim, deliveredOn }: { claim: ServiceClaim; deliveredOn?: string }) {
  const kind = CLAIM_TYPES.find((t) => t.id === claim.kind);
  const items: { icon: typeof Camera; label: string; detail: string; ok: boolean }[] = [
    {
      icon: Camera,
      label: `${claim.photos} tailgate photograph${claim.photos === 1 ? "" : "s"}`,
      detail: kind?.needsPhotos
        ? claim.photos
          ? "This claim type needs photographs, and they are on file."
          : "This claim type needs photographs and none are on file — the figure cannot be released on the records alone."
        : "Not required for this claim type; on file anyway.",
      ok: kind?.needsPhotos ? claim.photos > 0 : true,
    },
    {
      icon: Receipt,
      label: `Delivery receipt ${claim.receipt}`,
      detail: deliveredOn
        ? `Signed on delivery, ${deliveredOn}. The unit count the claim is measured against comes from here.`
        : "On file. The unit count the claim is measured against comes from here.",
      ok: true,
    },
    {
      icon: Barcode,
      label: `Batch ${claim.batch}`,
      detail:
        "Ties the material to its run, which is what turns a second claim on the same lot from an incident into a pattern.",
      ok: true,
    },
    /* Computed, not asserted. This line read "inside the window" on a claim
       that was declined FOR being outside it — the one place on the page where
       the evidence contradicted the decision above it. Where the two dates do
       not admit an answer the line states the window and stops rather than
       guessing at a verdict. */
    filingLine(claim, kind?.windowDays, deliveredOn),
  ];

  return (
    <div className="flex flex-col">
      {items.map((it, i) => (
        <div
          key={it.label}
          className="flex items-start gap-3"
          style={{ padding: "12px 16px", borderBottom: i === items.length - 1 ? undefined : HAIR }}
        >
          <it.icon
            size={16}
            weight="duotone"
            className="mt-[2px] shrink-0"
            style={{ color: it.ok ? "#0D9467" : "#DE1010" }}
          />
          <span className="flex min-w-0 flex-col" style={{ gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ds-text-primary)" }}>
              {it.label}
            </span>
            <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--ds-text-secondary)" }}>
              {it.detail}
            </span>
          </span>
        </div>
      ))}
      {claim.note && (
        <div style={{ padding: "12px 16px", borderTop: HAIR }}>
          <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--ds-text-secondary)" }}>
            {claim.note}
          </span>
        </div>
      )}
    </div>
  );
}
