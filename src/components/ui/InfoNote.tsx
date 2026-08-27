import { Info } from "@phosphor-icons/react";

/**
 * A quiet note explaining what a control will do.
 *
 * The design system has no primitive for this — it carries Tooltip and an `info`
 * prop on KpiBreakdownCard, both of which hide the text behind a hover, and this
 * text is meant to be read before anybody touches the control. So it lives here
 * rather than being drawn again at each call site: the HMTX portal uses the same
 * block in more than one place, and two copies would drift on the second edit.
 *
 * Tokens are the design's own (neutral 50 / 200 / 600 at 12px, 18px line) because
 * this is a port, and the app's `--surface-sunken` and `--ds-border-subtle`
 * resolve to those values anyway.
 */
export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex w-full items-start"
      style={{
        gap: 4,
        padding: 12,
        borderRadius: 8,
        border: "1px solid var(--ds-border-subtle, #e4e4e7)",
        background: "var(--surface-sunken, #fafafa)",
      }}
    >
      {/* Nudged down 3px rather than centred: the icon should sit on the first
          line's baseline, and centring it against a block that wraps to two lines
          floats it into the gap between them. */}
      <span className="flex shrink-0 items-center" style={{ paddingTop: 3 }}>
        <Info size={12} color="#52525c" />
      </span>
      <span className="min-w-0 flex-1" style={{ fontSize: 12, lineHeight: "18px", color: "#52525c" }}>
        {children}
      </span>
    </div>
  );
}
