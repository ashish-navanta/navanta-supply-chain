import { linesFor, type ActionRow } from "@/data/action-center";
import { money, type Play } from "@/data/buying";

/**
 * What a committed decision reports to the surface that raises the toast.
 *
 * The wording lives here rather than inside each modal because the row's Approve
 * button commits without ever opening one — the same decision, taken from the
 * list. Two places writing that sentence would be two places to drift.
 */
export interface CommitReport {
  title: string;
  message: string;
}

/** The lead time the supplier is asking for, in days. */
export function recommendedLead(row: ActionRow): number {
  return Math.max(...linesFor(row).map((l) => l.leadDays));
}

export function leadTimeCommit(
  row: ActionRow,
  agent: string,
  days: number,
  landsOn: string | null,
  reason?: string | null,
): CommitReport {
  const overridden = days !== recommendedLead(row);
  const note = overridden && reason ? ` Reason logged: ${reason.toLowerCase()}.` : "";
  return {
    title: `${row.ref} — lead time set to ${days} days${overridden ? " (your override)" : ""}`,
    message: `Written to the supplier record for the next three months and handed to planning. ${agent} is watching ${landsOn ?? "the revised date"}.${note}`,
  };
}

export function safetyStockCommit(
  row: ActionRow,
  agent: string,
  units: number,
  reason?: string | null,
): CommitReport {
  const overridden = units !== (row.cover?.safetyNeeded ?? units);
  const note = overridden && reason ? ` Reason logged: ${reason.toLowerCase()}.` : "";
  return {
    title: `${row.refSub} — safety stock set to ${units} ${row.qtyUnit}${
      overridden ? " (your override)" : ""
    }`,
    message: `Written to the coverage policy at ${row.party} and the requisition raised. ${agent} is watching cover against the ${row.cover?.leadDays ?? 0}-day lead time.${note}`,
  };
}

/** The rate the recommendation implies, in whole points — the figure the
 *  override panel steps through, and the anchor both commit paths compare to. */
export function recommendedRate(play: Play): number {
  return Math.max(1, Math.round((play.recommended / play.addressable) * 100));
}

export function playCommit(
  play: Play,
  agent: string,
  rate: number,
  reason?: string | null,
): CommitReport {
  const rec = recommendedRate(play);
  const overridden = rate !== rec;
  /* At the recommended rate the committed figure is the recommendation itself,
     not the rate re-multiplied — the rate is a whole-point rounding of it, and
     re-deriving would report $2.5M for a play the screen called $2.4M. */
  const dollars = overridden ? Math.round((play.addressable * rate) / 100) : play.recommended;
  const note = overridden && reason ? ` Reason logged: ${reason.toLowerCase()}.` : "";
  return {
    title: `${play.id} — ${money(dollars)} committed${overridden ? " (your override)" : ""}`,
    message: `Booked against ${money(play.addressable)} addressable at ${rate}%${
      overridden ? ` rather than the recommended ${rec}%` : ""
    }. It moves to value realization and ${agent} raises it again if it falls behind ramp.${note}`,
  };
}

export function playDismiss(play: Play, agent: string): CommitReport {
  return {
    title: `${play.id} — dismissed`,
    message: `${agent} has logged the dismissal for sweep calibration. It will not resurface unless the underlying spend changes.`,
  };
}

export function claimCommit(
  row: ActionRow,
  agent: string,
  credit: number,
  reason?: string | null,
): CommitReport {
  const overridden = credit !== (row.claim?.credit ?? credit);
  const note = overridden && reason ? ` Reason logged: ${reason.toLowerCase()}.` : "";
  const usd = `$${credit.toLocaleString()}`;
  return {
    title: `${row.ref} — ${usd} credit issued${overridden ? " (your override)" : ""}`,
    message: `Raised against ${row.claim?.receipt ?? "the delivery receipt"} and the invoice corrected. ${agent} has told ${row.party} and will confirm the collection.${note}`,
  };
}
