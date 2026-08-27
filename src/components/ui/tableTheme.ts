// Shared DataTable appearance for every Action Center table — a clean header
// (divider only, no fill), comfortable 56px rows, subtle dividers and a soft
// hover. Spread into each <DataTable> so all four persona queues read as one
// surface. Mirrors the IRIS floor-plan table theme.
export const SHAW_TABLE_PROPS = {
  headerVariant: "default" as const,
  rowBorderColor: "#F1F3F5",
  rowHoverBg: "var(--surface-hover)",
  // 12px (the DS default) rather than IRIS's 16 — this table carries nine
  // columns including the Iris Insight line, and 16 pushed the action button
  // into horizontal overflow on a 1280-wide screen.
  cellPaddingX: 12,
  headerPaddingX: 12,
  rowHeight: 56,
  headerHeight: 44,
};
