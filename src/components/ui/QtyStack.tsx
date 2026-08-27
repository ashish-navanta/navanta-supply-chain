/**
 * A quantity: the figure, with its unit under it.
 *
 * Four columns of stock sit side by side on the planning table — on hand,
 * incoming, safety stock, requested — and repeating "ctn" inline four times
 * across every row turns a line of numbers into a line of prose. Stacked, the
 * figures align in one scannable column and the unit says itself once per cell
 * without competing for the same eye.
 *
 * The same shape the queue already uses for its quantity cell, so a number
 * reads the same way on both screens.
 */
export function QtyStack({
  value,
  unit = "units",
}: {
  value: React.ReactNode;
  /** Plural, and spelled out — "ctn" saved four characters nobody was short of. */
  unit?: string;
}) {
  return (
    <span className="flex flex-col" style={{ gap: 1 }}>
      <span
        style={{
          fontSize: 14,
          color: "var(--ds-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>{unit}</span>
    </span>
  );
}
