"use client";

import Link from "next/link";
import {
  ArrowSquareOut,
  ClipboardText,
  MapPin,
  Package,
  Phone,
  Storefront,
  User,
} from "@phosphor-icons/react";
import { AiStar, Pill } from "@navanta-ai/design-system";
import { SERVICE_ROUTES } from "@/data/nav";
import { PERSONAS } from "@/types/persona";
import { contactFor } from "@/data/action-center";
import { HAIR } from "@/components/ui/RecordCard";
import {
  CLAIMS,
  ORDERS,
  OPEN_CLAIM_STAGES,
  formatUsdFull,
  type Account,
  type LoyaltyTier,
} from "@/data/service";

/**
 * Who Target is talking to, as something you can read at a glance.
 *
 * This was eight rows of label-and-value, which is the right shape for a
 * reference — an address, an order number, a term — and the wrong one here. Four
 * of those eight rows are the numbers that decide how a call goes: how often
 * Target has been late to this account, how often they claim, what they are worth,
 * how long they have been trading. Set in a column of identical rows they read
 * as trivia; set as figures they read as a position.
 *
 * The rest is what a CSR actually reaches for mid-call — the name and number at
 * the top where a phone is already in their hand, the agent's line on the
 * relationship at the bottom, and what else is open with them, because "we also
 * owe you two other orders" is the thing you must not be told by the account.
 */

const TIER_COLOR: Record<LoyaltyTier, { bg: string; fg: string }> = {
  Platinum: { bg: "#EEF2FF", fg: "#3730A3" },
  Gold: { bg: "#FEF3C7", fg: "#92400E" },
  Silver: { bg: "#F1F5F9", fg: "#475569" },
  Bronze: { bg: "#FFEDD5", fg: "#9A3412" },
};

/** One figure, with what it measures above it. */
function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-0.5 rounded-[8px] p-2.5"
      style={{ border: "1px solid #E4E5E7", background: "var(--surface-base)" }}
    >
      <span className="truncate" style={{ fontSize: 12, lineHeight: "18px", color: "#71767A" }}>
        {label}
      </span>
      <span
        className="font-medium"
        style={{
          fontSize: 18,
          lineHeight: "26px",
          fontVariantNumeric: "tabular-nums",
          color: tone === "bad" ? "#DE1010" : tone === "good" ? "#0D9467" : "#181A1B",
        }}
      >
        {value}
      </span>
      {sub && (
        <span className="truncate" style={{ fontSize: 12, lineHeight: "18px", color: "#979B9F" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

export function AccountPanel({ account, orderId }: { account: Account; orderId: string }) {
  const contact = contactFor(account.name, false);
  const tier = TIER_COLOR[account.tier];

  /* What else this account has with Target right now. Counted rather than stated,
     and excluding the order being read — "one other order open" is a fact, "two
     orders open" while you are looking at one of them is a puzzle. */
  const otherOrders = ORDERS.filter(
    (o) => o.account === account.name && o.id !== orderId && o.stage !== "delivered",
  );
  const openClaims = CLAIMS.filter(
    (c) => c.account === account.name && OPEN_CLAIM_STAGES.has(c.stage),
  );

  /* Target's own record with them, and the thresholds are the seat's: below 90% on
     time is a conversation the account will already have opened, and two claims per
     hundred orders is where a pattern starts rather than an accident. */
  const lateTone = account.onTimePct >= 95 ? "good" : account.onTimePct < 90 ? "bad" : undefined;
  const claimTone = account.claimRate <= 1.5 ? "good" : account.claimRate > 4 ? "bad" : undefined;

  return (
    <div className="flex flex-col">
      {/* ── Who they are, and how to reach them ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full font-medium"
            style={{ background: tier.bg, color: tier.fg, fontSize: 14 }}
            aria-hidden="true"
          >
            {account.name
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Link
                href={SERVICE_ROUTES.accounts}
                title={`Open ${account.name}'s record`}
                className="truncate font-medium hover:underline"
                style={{ fontSize: 16, lineHeight: "24px", color: "var(--link-color)" }}
              >
                {account.name}
              </Link>
              <Pill size="sm" variant="neutral">
                {account.tier}
              </Pill>
            </span>
            <span
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
              style={{ fontSize: 13, lineHeight: "20px", color: "#71767A" }}
            >
              <span className="flex items-center gap-1">
                <Storefront size={13} className="shrink-0" />
                {`${account.segment} · ${account.id}`}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={13} className="shrink-0" />
                {`${account.city}, ${account.state}`}
              </span>
              <span>{`Trading since ${account.since}`}</span>
            </span>
          </div>
        </div>

        {/* The phone, at the size somebody dialling it needs. This is a service
            seat: the single most likely next action on this panel is a call. */}
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <span
            className="flex items-center gap-1.5"
            style={{ fontSize: 13, lineHeight: "20px", color: "#71767A" }}
          >
            <User size={13} className="shrink-0" />
            {contact.name}
          </span>
          <a
            href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
            className="flex items-center gap-1.5 font-medium hover:underline"
            style={{ fontSize: 15, lineHeight: "22px", color: "var(--ds-text-primary)", fontVariantNumeric: "tabular-nums" }}
          >
            <Phone size={14} weight="duotone" className="shrink-0" style={{ color: "#71767A" }} />
            {contact.phone}
          </a>
        </div>
      </div>

      {/* ── The four figures that change how the call goes ── */}
      <div
        className="grid gap-2 px-4 pb-4"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        <Stat
          label="On time, 12 months"
          value={`${account.onTimePct}%`}
          sub="of deliveries to promise"
          tone={lateTone}
        />
        <Stat
          label="Claim rate"
          value={account.claimRate.toFixed(1)}
          sub="per 100 orders"
          tone={claimTone}
        />
        <Stat label="Revenue, year to date" value={formatUsdFull(account.ytdRevenue)} sub={account.segment} />
        <Stat label="Payment terms" value={account.paymentTerms} sub={`${account.tier} account`} />
      </div>

      {/* ── What else is open with them ── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{ borderTop: HAIR }}
      >
        <span
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
          style={{ fontSize: 13, lineHeight: "20px", color: "#52525c" }}
        >
          <span className="flex items-center gap-1.5">
            <Package size={14} weight="duotone" className="shrink-0" style={{ color: "#71767A" }} />
            {otherOrders.length
              ? `${otherOrders.length} other order${otherOrders.length === 1 ? "" : "s"} open`
              : "No other order open"}
          </span>
          <span className="flex items-center gap-1.5">
            <ClipboardText size={14} weight="duotone" className="shrink-0" style={{ color: "#71767A" }} />
            {openClaims.length
              ? `${openClaims.length} claim${openClaims.length === 1 ? "" : "s"} open · ${formatUsdFull(
                  openClaims.reduce((s, c) => s + (c.adjudicated ?? c.requested), 0),
                )}`
              : "No claim open"}
          </span>
        </span>
        <Link
          href={SERVICE_ROUTES.accounts}
          className="flex items-center gap-1 hover:underline"
          style={{ fontSize: 13, color: "var(--link-color)" }}
        >
          Account record
          <ArrowSquareOut size={12} className="shrink-0" />
        </Link>
      </div>

      {/* ── The agent's line on the relationship ── */}
      {account.note && (
        <div className="px-4 pb-4 pt-1">
          <div className="flex flex-col gap-1.5 rounded-[12px] p-3" style={{ background: "#F5EFFF" }}>
            <span className="flex items-center gap-2">
              <AiStar size={14} variant="small" />
              <span
                className="font-medium"
                style={{ fontSize: 13, lineHeight: "20px", color: "#181A1B" }}
              >
                {`${PERSONAS.csr.agent} on this account`}
              </span>
            </span>
            <p style={{ fontSize: 13, lineHeight: "20px", color: "#18181B" }}>{account.note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
