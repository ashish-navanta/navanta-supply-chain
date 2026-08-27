"use client";

import * as React from "react";
import { Check, Copy } from "@phosphor-icons/react";

/**
 * The card a record page is built out of.
 *
 * Lifted from the portal's order detail so a account order and a purchase order
 * are laid out by one set of primitives rather than two that drift. Both pages
 * answer the same shape of question — where is it, what is it worth, who is
 * carrying it — and the moment they each own their own SectionCard, one of them
 * gets a 4px corner in a redesign and the other does not.
 */

export const HAIR = "1px solid #F0F2F5";
/* The one shadow and the one radius every card on a record page uses. They were
   drifting — 8px here, 12px there, a hairline border on the money card instead
   of a shadow — and a column of cards at three different radii reads as three
   different components rather than one page. */
export const CARD_SHADOW = "0 0 1px 0 rgba(0, 0, 0, 0.10), 0 1px 2px 0 rgba(10, 24, 48, 0.08)";
export const CARD_RADIUS = 12;

/**
 * A card's heading, drawn the way the DS TableShell draws its own.
 *
 * 14px medium beside a 14px duotone glyph, on `px-4 pt-4 pb-3`. The record
 * pages mix hand-built cards with a real TableShell, and at 16px the hand-built
 * ones sat a step louder than the shell right beneath them — which made the
 * page look like two components rather than one surface.
 */
export function CardHeading({
  icon: Icon,
  children,
  right,
}: {
  icon?: React.ComponentType<{ size?: number; weight?: "duotone"; className?: string }>;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-4">
      <span className="flex items-center gap-2">
        {Icon && (
          <Icon size={14} weight="duotone" className="size-[14px] shrink-0 text-[var(--text-primary)]" />
        )}
        <span
          className="font-medium"
          style={{ fontSize: 14, lineHeight: 1.4, color: "var(--text-primary)" }}
        >
          {children}
        </span>
      </span>
      {right}
    </div>
  );
}

export function SectionCard({
  title,
  icon,
  right,
  children,
  className = "",
  style,
}: {
  title?: string;
  icon?: React.ComponentType<{ size?: number; weight?: "duotone"; className?: string }>;
  /** Trailing content in the header — a count, a link, a pill. */
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[var(--surface-base)] ${className}`}
      style={{ borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, ...style }}
    >
      {title && (
        <CardHeading icon={icon} right={right}>
          {title}
        </CardHeading>
      )}
      {children}
    </div>
  );
}

/** One label/value line in a record card. */
export function InfoRow({
  icon: Icon,
  label,
  children,
  last,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-start justify-between gap-4"
      style={{ padding: "12px 16px", borderBottom: last ? undefined : HAIR }}
    >
      <span className="flex shrink-0 items-center" style={{ gap: 6 }}>
        <Icon size={14} className="shrink-0" style={{ color: "#64748b" }} />
        <span
          className="whitespace-nowrap font-normal"
          style={{ fontSize: 14, lineHeight: 1.5, color: "#64748b" }}
        >
          {label}
        </span>
      </span>
      <span
        className="flex min-w-0 flex-col text-right font-medium"
        style={{ fontSize: 14, lineHeight: 1.5, color: "#212121" }}
      >
        {children}
      </span>
    </div>
  );
}

/** The secondary line inside an InfoRow — a phone number under a name. */
export function InfoSub({ children, tone }: { children: React.ReactNode; tone?: "danger" }) {
  return (
    <span style={{ fontWeight: 400, fontSize: 13, color: tone === "danger" ? "#DE1010" : "#64748b" }}>
      {children}
    </span>
  );
}

/**
 * The band under a stepper carrying the one sentence that changes what you do.
 *
 * It sits in the stepper's foot rather than in a banner up top because the
 * reader is already looking at the stepper to find out where the thing is, and
 * "where" and "so what" are one question.
 */
export function StatusAlert({
  tone,
  icon,
  title,
  body,
  details = [],
  footer,
}: {
  tone: "danger" | "warning" | "success";
  icon: React.ReactNode;
  title: string;
  body: string;
  details?: string[];
  footer?: React.ReactNode;
}) {
  const bg = tone === "danger" ? "#ffeded" : tone === "warning" ? "#fffbeb" : "#f0fdf4";
  return (
    <div className="flex w-full flex-col gap-3 px-4 pb-1">
      <div className="flex flex-col gap-[4px] rounded-[12px] px-3 py-2" style={{ background: bg }}>
        <div className="flex items-center gap-[4px]">
          {icon}
          <span className="text-[14px] font-medium leading-[22px] text-[#1E1E1E]">{title}</span>
        </div>
        <p className="text-[14px] font-normal leading-[22px] text-[#1E1E1E]">{body}</p>
        {details.map((line) => (
          <span key={line} className="text-[12px] leading-[18px] text-[#52525c]">
            {line}
          </span>
        ))}
        {footer}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  A record's fields, sectioned
 *
 *  Ported from the HMTX portal's Order Information card (Figma
 *  `1118:20640`). Three things it does that a flat label/value list
 *  does not:
 *
 *  Grouped under grey band headings — Order identity, Shipping,
 *  references — so a reader scanning for "who is it going to" looks in
 *  one place instead of down twenty rows.
 *
 *  Label ABOVE value, two to a row. A long value no longer has to
 *  compete with its own label for the same line, which is what made
 *  the right-aligned version truncate addresses and lane names.
 *
 *  A copy affordance on the references somebody actually retypes into
 *  another system, which is most of what a record page is for.
 * ═══════════════════════════════════════════════════════════════ */

/** A titled group of fields, under its grey band. */
export function RecordSection({
  icon: Icon,
  title,
  children,
}: {
  icon?: React.ComponentType<{ size?: number; weight?: "duotone"; style?: React.CSSProperties }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-start">
      <div
        className="flex w-full items-center gap-1.5 overflow-hidden rounded-[8px] p-2"
        style={{ background: "#F4F4F6" }}
      >
        {Icon && <Icon size={16} weight="duotone" style={{ color: "#181A1B" }} />}
        <span
          className="whitespace-nowrap font-medium"
          style={{ fontSize: 14, lineHeight: 1.5, color: "#181A1B" }}
        >
          {title}
        </span>
      </div>
      <div className="flex w-full flex-col gap-2 py-2">{children}</div>
    </div>
  );
}

/** One row of the section — one field across, or two side by side. */
export function FieldRow({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className="flex w-full items-start justify-between gap-4 px-2"
      style={{ borderBottom: last ? undefined : "1px solid #E4E5E7" }}
    >
      {children}
    </div>
  );
}

/**
 * A field: its name over its value.
 *
 * `copy` puts the value on the clipboard — offered only where a reader would
 * genuinely retype it somewhere else. On a date or a status it would be a button
 * that does nothing anyone wants.
 */
export function Field({
  icon: Icon,
  label,
  children,
  copy,
  tone,
}: {
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
  label: string;
  children: React.ReactNode;
  /** The exact string to copy. Omit for no copy button. */
  copy?: string;
  tone?: "danger";
}) {
  return (
    <div className="flex min-w-px flex-1 flex-col gap-1 py-1">
      <span className="flex items-center gap-1.5">
        {Icon && <Icon size={14} className="shrink-0" style={{ color: "#71767A" }} />}
        <span
          className="whitespace-nowrap"
          style={{ fontSize: 14, lineHeight: 1.5, color: "#71767A" }}
        >
          {label}
        </span>
      </span>
      {/* `items-start`, not `items-center`: a value that wraps to two lines should
          keep its copy button at the top of them rather than floating to the
          middle of a paragraph. */}
      <span className="flex min-w-0 items-start gap-2">
        <span
          className="min-w-0 font-medium"
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: tone === "danger" ? "#DE1010" : "#212121",
            /* Wrapping, so a long value takes a second line inside its own half of
               the row. Fields are laid out two to a row and several values are
               prose — a root cause, a lane, an address. Those carried `truncate`,
               which does nothing on an inline span (overflow needs a block), so
               instead of clipping they ran straight over the field beside them and
               the two texts drew on top of each other. */
            overflowWrap: "anywhere",
          }}
        >
          {children}
        </span>
        {copy && <CopyValue value={copy} label={label} />}
      </span>
    </div>
  );
}

/** The copy button, with the tick it owes the reader after a click. */
function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      className="shrink-0 transition-transform active:scale-90"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? (
        <Check size={13} weight="bold" style={{ color: "#0D9467" }} />
      ) : (
        <Copy size={13} style={{ color: "#979B9F" }} />
      )}
    </button>
  );
}
