import { AiStar } from "@navanta-ai/design-system";

/**
 * A starred column header — "✦ Mercer Insight", "✦ Action".
 *
 * The star marks the columns that belong to the agent: the one it writes and
 * the one that hands work back to it. Marking them at the head is why the
 * buttons underneath do not each need a star of their own — said once per
 * column it is a label, said six times down a column it is decoration.
 */
export function AgentColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center" style={{ gap: 4 }}>
      <AiStar size={14} variant="small" />
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          lineHeight: "18px",
          color: "var(--ds-text-primary)",
        }}
      >
        {children}
      </span>
    </span>
  );
}
