"use client";

import { useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  CheckCircle,
  Circle,
  Lock,
  MinusCircle,
  Paperclip,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { AiStar, Button, Input, Tooltip } from "@navanta-ai/design-system";
import { RUN_KINDS, STEP_SUPPORT, type PlayTask, type StepKind } from "@/data/buying";

/**
 * The play's guided step list — the Act workspace.
 *
 * Ported from the Allison procurement Act tracker. Step one attaches the scope
 * file and GATES the rest: every figure after it is computed against that file,
 * so working ahead of it produces numbers nobody can stand behind. Each open,
 * unlocked step offers what the agent can do for it — run a check, model a
 * price, build a shortlist, draft a document — or nothing, where the work is a
 * conversation and only the buyer can say it happened.
 *
 * "Edit list" is the escape hatch, not the default. A tracker that opens in
 * management mode invites tidying the plan instead of working it.
 */

/** What a finished run put on screen, so the reader sees output not just a tick. */
const RUN_OUTPUT: Record<string, string[]> = {
  validate: [
    "Capacity holds at the consolidated volume — two of three plants have headroom.",
    "Service record is clean over twelve months; terms are the weakest part of the file.",
  ],
  model: [
    "Consolidated volume supports a 4.2% unit reduction before freight.",
    "Freight lands 0.6% of it back — the net is 3.6% on the addressable spend.",
  ],
  benchmark: [
    "This category sits 5.1% above the market median for comparable volume.",
    "Should-cost puts the floor 6.8% below today, which the band already assumes.",
  ],
  shortlist: [
    "Three qualified suppliers, ranked on capacity, quality history and lane fit.",
    "The incumbent stays on the list — a shortlist without them is not a negotiation.",
  ],
};

export function PlayTracker({
  agent,
  tasks,
  onMark,
  onAttach,
  onAdd,
  onRemove,
  onReopenAll,
}: {
  agent: string;
  tasks: PlayTask[];
  onMark: (index: number, status: PlayTask["status"]) => void;
  onAttach: (index: number, name: string) => void;
  onAdd: (label: string) => void;
  onRemove: (index: number) => void;
  onReopenAll: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [ran, setRan] = useState<Set<number>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const fileFor = useRef<number | null>(null);

  const complete = tasks.filter((t) => t.status !== "open").length;
  const fulfilled = complete === tasks.length && tasks.length > 0;
  const currentIndex = tasks.findIndex((t) => t.status === "open");

  /* The gate: the first upload step must be done before anything after it
     unlocks. Located rather than assumed to be index 0, because a buyer can add
     steps and reorder their own work. */
  const gateAt = tasks.findIndex((t) => t.kind === "upload");
  const gateDone = gateAt < 0 || tasks[gateAt].status !== "open";

  const submitAdd = () => {
    const label = draft.trim();
    if (!label) return;
    onAdd(label);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const at = fileFor.current;
          const names = Array.from(e.target.files ?? [])
            .map((f) => f.name)
            .join(", ");
          if (at !== null && names) onAttach(at, names);
          e.target.value = "";
          fileFor.current = null;
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
          {`${complete}/${tasks.length} complete`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant={editing ? "primary" : "outline"}
            size="sm"
            iconLeft={editing ? undefined : <PencilSimple size={13} weight="bold" />}
            onClick={() => {
              setEditing((v) => !v);
              setAdding(false);
              setDraft("");
            }}
          >
            {editing ? "Done editing" : "Edit list"}
          </Button>
          {fulfilled && (
            <span className="flex items-center gap-1">
              <span
                className="flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[11px] font-medium"
                style={{ background: "#D6F5E2", color: "#008234" }}
              >
                <CheckCircle size={12} weight="fill" />
                Every step done
              </span>
              <Tooltip content="Reopen all steps">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={onReopenAll}
                  aria-label="Reopen all steps"
                >
                  <ArrowCounterClockwise size={14} style={{ color: "var(--ds-text-secondary)" }} />
                </Button>
              </Tooltip>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        {tasks.map((task, i) => {
          const kind: StepKind = task.kind;
          const isDone = task.status === "done";
          const isSkip = task.status === "skipped";
          const isOpen = task.status === "open";
          const isCurrent = i === currentIndex;
          const locked = !editing && gateAt >= 0 && i > gateAt && !gateDone;
          const support = STEP_SUPPORT[kind];
          const showOutput = !editing && RUN_KINDS.has(kind) && (isDone || ran.has(i));

          return (
            <div
              key={`${task.label}-${i}`}
              className="flex items-start gap-2.5 py-2.5"
              style={{ borderTop: i > 0 ? "1px solid var(--ds-border-subtle)" : undefined }}
            >
              {locked ? (
                <span className="mt-px shrink-0" aria-label="Locked until scope is attached">
                  <Lock size={18} weight="bold" color="#CBD5E1" />
                </span>
              ) : (
                <Tooltip content={isOpen ? "Mark complete" : "Reopen"} className="mt-px shrink-0">
                  <button
                    type="button"
                    onClick={editing ? undefined : () => onMark(i, isOpen ? "done" : "open")}
                    disabled={editing}
                    aria-label={isOpen ? `Mark complete: ${task.label}` : `Reopen: ${task.label}`}
                    className="block rounded-full transition-transform enabled:hover:scale-110"
                  >
                    {isDone ? (
                      <CheckCircle size={20} weight="fill" color="#008234" />
                    ) : isSkip ? (
                      <MinusCircle size={20} weight="fill" color="#94A3B8" />
                    ) : (
                      <Circle size={20} weight="bold" color={isCurrent ? "#64748B" : "#CBD5E1"} />
                    )}
                  </button>
                </Tooltip>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="min-w-0 leading-snug"
                    style={{
                      fontSize: 13,
                      color: locked || !isOpen ? "var(--ds-text-secondary)" : "var(--ds-text-primary)",
                      fontWeight: isCurrent && !locked ? 500 : 400,
                    }}
                  >
                    {task.label}
                    {isSkip && (
                      <span className="ml-1.5 text-[10px] font-medium" style={{ color: "#94A3B8" }}>
                        skipped
                      </span>
                    )}
                    {task.custom && (
                      <span className="ml-1.5 text-[10px] font-medium" style={{ color: "#64748B" }}>
                        added
                      </span>
                    )}
                    {locked && (
                      <span className="ml-1.5 text-[10px] font-medium" style={{ color: "#94A3B8" }}>
                        locked
                      </span>
                    )}
                  </span>

                  {editing && (
                    <div className="flex shrink-0 items-center gap-3">
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => onMark(i, "done")}
                          className="text-[11px] font-medium hover:underline"
                          style={{ color: "var(--link-color)" }}
                        >
                          Mark done
                        </button>
                      )}
                      {!isSkip && (
                        <button
                          type="button"
                          onClick={() => onMark(i, "skipped")}
                          className="text-[11px] font-medium hover:underline"
                          style={{ color: "var(--link-color)" }}
                        >
                          Skip
                        </button>
                      )}
                      {!isOpen && (
                        <button
                          type="button"
                          onClick={() => onMark(i, "open")}
                          className="text-[11px] font-medium hover:underline"
                          style={{ color: "var(--link-color)" }}
                        >
                          Reopen
                        </button>
                      )}
                      <Tooltip content="Remove step">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => onRemove(i)}
                          aria-label={`Remove step: ${task.label}`}
                        >
                          <Trash size={14} style={{ color: "var(--ds-text-secondary)" }} />
                        </Button>
                      </Tooltip>
                    </div>
                  )}
                </div>

                {task.attachment && (
                  <span
                    className="flex items-center gap-1"
                    style={{ fontSize: 11, color: "var(--ds-text-secondary)" }}
                  >
                    <Paperclip size={11} />
                    {task.attachment}
                  </span>
                )}

                {/* What the agent offers on this step. Only on the open,
                    unlocked one — an assist card on a step nobody can work yet
                    is a button that has to be explained away. */}
                {!editing && isOpen && !locked && support && (
                  <div
                    className="mt-1 flex flex-col gap-2 rounded-[8px] p-2.5"
                    style={{ background: "var(--surface-base)", border: "1px solid var(--ds-border-subtle)" }}
                  >
                    <span className="flex items-start gap-1.5">
                      <AiStar size={13} variant="small" className="mt-0.5 shrink-0" />
                      <span style={{ fontSize: 12, color: "var(--ds-text-secondary)" }}>
                        {support.helper}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (kind === "upload") {
                            fileFor.current = i;
                            fileInput.current?.click();
                            return;
                          }
                          if (RUN_KINDS.has(kind)) {
                            setRan((prev) => new Set(prev).add(i));
                            return;
                          }
                          onMark(i, "done");
                        }}
                      >
                        {support.cta}
                      </Button>
                      <button
                        type="button"
                        onClick={() => onMark(i, "skipped")}
                        className="text-[11px] font-medium hover:underline"
                        style={{ color: "var(--ds-text-secondary)" }}
                      >
                        Skip this step
                      </button>
                    </span>
                  </div>
                )}

                {/* The run's output, and the tick that has to follow it. The
                    buyer marks the step done — the agent produced a figure, it
                    did not decide the figure was good enough. */}
                {showOutput && (
                  <div
                    className="mt-1 flex flex-col gap-1.5 rounded-[8px] p-2.5"
                    style={{ background: "var(--color-iris-50)" }}
                  >
                    <span className="flex items-center gap-1.5">
                      <AiStar size={13} variant="small" />
                      <span
                        style={{ fontSize: 12, fontWeight: 500, color: "var(--ds-text-primary)" }}
                      >
                        {`${agent} ran this`}
                      </span>
                    </span>
                    {(RUN_OUTPUT[kind] ?? []).map((line) => (
                      <span key={line} style={{ fontSize: 12, color: "var(--ds-text-primary)" }}>
                        {line}
                      </span>
                    ))}
                    {isOpen && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1 self-start"
                        onClick={() => onMark(i, "done")}
                      >
                        Accept and move on
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="flex items-center gap-2">
          {adding ? (
            <>
              <Input
                size="md"
                autoFocus
                value={draft}
                placeholder="What else has to happen?"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAdd();
                  if (e.key === "Escape") setAdding(false);
                }}
                aria-label="New step"
              />
              <Button variant="outline" size="sm" onClick={submitAdd} disabled={!draft.trim()}>
                Add
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Plus size={13} weight="bold" />}
              onClick={() => setAdding(true)}
            >
              Add a step
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
