"use client";

import { historyFor, type ActionRow } from "@/data/action-center";

/**
 * What has happened on this order, oldest first, each entry naming the system or
 * the agent it came from. Shared by both modals — the decision needs the trail to
 * justify the call, the contact needs it to know what has already been tried.
 *
 * A staged-but-uncommitted figure appears as the last entry in brand colour, so
 * the log never implies something was written that wasn't.
 */
export function ActivityHistory({
  row,
  agent,
  leadProposed,
}: {
  row: ActionRow;
  agent: string;
  /** A pending override, shown as the final uncommitted entry. */
  leadProposed?: string;
}) {
  const history = historyFor(row, agent, leadProposed);

  return (
    <ol
      className="flex flex-col gap-3 rounded-xl px-5 py-4"
      style={{ border: "1px solid var(--ds-border-default)" }}
    >
      {history.map((h) => (
        <li key={`${h.when}-${h.what}`} className="flex gap-4">
          <span
            className="ds-label shrink-0"
            style={{ width: 96, color: "var(--ds-text-secondary)" }}
          >
            {h.when}
          </span>
          <span className="flex min-w-0 flex-col">
            <span
              className="ds-body"
              style={{ color: h.pending ? "var(--color-iris-700)" : "var(--ds-text-primary)" }}
            >
              {h.what}
            </span>
            <span className="ds-label" style={{ color: "var(--text-muted)" }}>
              {h.source}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
