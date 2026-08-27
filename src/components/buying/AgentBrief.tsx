"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AiStar } from "@navanta-ai/design-system";

/**
 * The agent's opening statement on a page — the same lavender band the modals
 * lead with, at page scale. One dense paragraph in the queue's house voice
 * (mid-dot separated, concrete figures) and a row of chips that take you to the
 * thing the paragraph just described.
 *
 * The chips are the point: a synthesis that names five numbers and then leaves
 * you to find them is a wall of text. Every claim worth acting on gets a door.
 */

export interface BriefChip {
  label: string;
  href: string;
}

export function AgentBrief({
  agent,
  title,
  paragraph,
  chips,
  children,
}: {
  agent: string;
  /** Defaults to "<Agent> Summary", matching the modals. */
  title?: string;
  paragraph: string;
  chips?: BriefChip[];
  /** Anything that belongs inside the band — a stat strip, a callout. */
  children?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-3 overflow-hidden rounded-xl p-5"
      style={{ background: "var(--color-iris-50)" }}
    >
      <span className="flex items-center gap-2">
        <AiStar size={18} variant="small" />
        <span className="type-subheading" style={{ color: "var(--ds-text-primary)" }}>
          {title ?? `${agent} Summary`}
        </span>
      </span>

      <p
        className="ds-body max-w-[112ch]"
        style={{ color: "var(--ds-text-primary)" }}
      >
        {paragraph}
      </p>

      {children}

      {chips && chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {chips.map((chip) => (
            <Link
              key={chip.href + chip.label}
              href={chip.href}
              className="ds-label inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors hover:brightness-[0.98]"
              style={{
                background: "var(--surface-base)",
                border: "1px solid var(--color-iris-200)",
                color: "var(--color-iris-700)",
                fontWeight: 500,
              }}
            >
              <AiStar size={12} variant="small" />
              {chip.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
