"use client";

/**
 * "AI Agent" — the badge that says what you are talking to.
 *
 * Ported from Figma `632:19946`: an 18px `#94A3B8` square at a 4px radius with
 * "AI" in 10px medium `#FAFCFF`, then "Agent" in 14px medium `#71767A`, gap 4.
 *
 * It earns its place beside the agent's name. "Iris" alone reads as a colleague,
 * and every judgement on these screens is one a person is meant to check rather
 * than accept — a reader who has forgotten which of the two they are reading is
 * exactly the reader who stops checking.
 */
export function AgentBadge() {
  return (
    <span className="flex items-center gap-1">
      <span
        className="flex flex-col items-center justify-center rounded-[4px]"
        style={{ background: "#94A3B8", width: 18, height: 18, padding: "2px 4px" }}
      >
        <span style={{ fontSize: 10, fontWeight: 500, color: "#FAFCFF", lineHeight: "normal" }}>
          AI
        </span>
      </span>
      <span
        className="whitespace-nowrap"
        style={{ fontSize: 14, fontWeight: 500, color: "#71767A", lineHeight: "normal" }}
      >
        Agent
      </span>
    </span>
  );
}
