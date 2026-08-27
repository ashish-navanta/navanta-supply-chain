import { Pill } from "@navanta-ai/design-system";

/**
 * Nothing wrong with this one, said out loud.
 *
 * The status columns used to print an em dash for a clean row, which reads as
 * missing data — the reader cannot tell whether the row is fine or whether
 * nobody has assessed it, and on a risk or exception column that is the one
 * thing it must not leave open.
 *
 * Green, and styled rather than a variant: the design system's pill has info,
 * warning, danger and neutral, and none of them is success. Tinted from
 * `--success` so it is the same green as the buyer's realized-value ramp rather
 * than a second green in the app.
 */
export function OnTrackPill({ label = "On track" }: { label?: string }) {
  return (
    <Pill
      size="sm"
      variant="neutral"
      style={{ background: "var(--surface-success-alt)", color: "var(--success)" }}
    >
      {label}
    </Pill>
  );
}
