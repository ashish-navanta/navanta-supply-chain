"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Package, X } from "@phosphor-icons/react";
import {
  Button,
  Pill,
  Radio,
  Select,
  Textarea,
} from "@navanta-ai/design-system";
import {
  STOCKING_POLICY_META,
  STOCKING_POLICY_ORDER,
  type SkuPolicyRow,
  type StockingPolicy,
} from "@/data/planning";

/**
 * Override the stocking policy on one product · branch.
 *
 * Ported from IRIS's `policy/_components/PolicyOverrideModal.tsx`. Two rules in
 * it are easy to lose and are the whole reason the modal exists rather than a
 * dropdown in the row:
 *
 *   Choosing the policy IRIS recommends is a REVERT, not an override. It takes
 *   the row off the exception list and needs no justification, so the reason
 *   fields do not appear for it.
 *
 *   Any other choice needs a reason, because the reason is not paperwork — it
 *   feeds model calibration and the audit log. "Other" is not a reason, so it
 *   additionally requires a note.
 */

/** IRIS's own list. */
export const REASONS = [
  "Seasonal demand",
  "Vendor / lead-time change",
  "Critical spare",
  "Known one-off",
  "Manual judgment",
  "Other",
];

export function PolicyOverrideModal({
  row,
  onClose,
  onConfirm,
}: {
  row: SkuPolicyRow;
  onClose: () => void;
  /** `reason` is empty on a revert — there is nothing to justify. */
  onConfirm: (next: StockingPolicy, reason: string) => void;
}) {
  const system = row.systemPolicy;
  const current = row.currentPolicy;
  const [choice, setChoice] = useState<StockingPolicy>(current);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const changed = choice !== current;
  const revertingToSystem = choice === system;
  const notesRequired = !revertingToSystem && reason === "Other";
  const confirmDisabled =
    !changed ||
    (!revertingToSystem && (reason.trim() === "" || (notesRequired && note.trim() === "")));
  const auditReason = note.trim() ? `${reason} · ${note.trim()}` : reason;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(15, 16, 35, 0.55)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Override stocking policy for ${row.sku}`}
        className="relative flex w-full max-w-[640px] flex-col overflow-hidden rounded-[16px] bg-[var(--surface-base)]"
        style={{
          boxShadow: "var(--shadow-modal, 0 24px 48px rgba(10,24,48,0.24))",
          maxHeight: "calc(100vh - 80px)",
          animation: "modal-fade-up 0.2s ease-out both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start justify-between"
          style={{ padding: "16px 24px", borderBottom: "1px solid #E4E5E7", gap: 8 }}
        >
          <div className="flex min-w-0 items-start" style={{ gap: 8 }}>
            <div className="shrink-0" style={{ paddingTop: 2 }}>
              <Package size={16} weight="regular" color="#181A1B" />
            </div>
            <div className="flex min-w-0 flex-col" style={{ gap: 6 }}>
              <span className="type-subheading tabular-nums" style={{ color: "#181A1B" }}>
                {row.sku}
              </span>
              <div className="flex min-w-0 items-center" style={{ gap: 8 }}>
                <span className="type-body truncate font-normal" style={{ color: "#52525C" }}>
                  {row.description}
                </span>
                <span className="flex shrink-0 items-center" style={{ gap: 6 }}>
                  <Pill variant="neutral" size="sm">
                    {row.branch}
                  </Pill>
                  <Pill variant="neutral" size="sm">
                    {row.classification}
                  </Pill>
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
            <X size={14} weight="bold" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col" style={{ padding: 24, gap: 16 }}>
            <div className="flex flex-col" style={{ gap: 8 }}>
              <span className="type-body-medium" style={{ color: "#181A1B" }}>
                Stocking policy
              </span>
              <div
                role="radiogroup"
                aria-label="Stocking policy"
                className="flex flex-col"
                style={{ gap: 8 }}
              >
                {STOCKING_POLICY_ORDER.map((p) => (
                  <Radio
                    key={p}
                    card
                    name="stocking-policy"
                    value={p}
                    checked={choice === p}
                    onChange={() => setChoice(p)}
                    label={STOCKING_POLICY_META[p].label}
                    helperText={STOCKING_POLICY_META[p].description}
                    badge={
                      /* The active option is Current; the system default is
                         labelled only when it is not already the current one,
                         so an un-overridden row shows a single badge. */
                      p === current ? (
                        <Pill variant="info" size="sm">
                          Current Policy
                        </Pill>
                      ) : p === system ? (
                        <Pill variant="neutral" size="sm">
                          IRIS recommends
                        </Pill>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </div>

            {changed && revertingToSystem && (
              <p className="type-caption font-normal" style={{ color: "var(--ds-text-secondary)" }}>
                Rolling back to what IRIS recommends removes this product · branch from the
                exception list, and the monthly re-classification will pick it up again.
              </p>
            )}

            {changed && !revertingToSystem && (
              <div className="flex flex-col" style={{ gap: 12 }}>
                <div className="flex flex-col" style={{ gap: 6 }}>
                  <span className="type-body-medium" style={{ color: "#181A1B" }}>
                    Reason
                  </span>
                  <Select value={reason} onValueChange={setReason}>
                    <Select.Trigger size="md" aria-label="Override reason">
                      <Select.Value placeholder="Why is this being overridden?" />
                    </Select.Trigger>
                    <Select.Content>
                      {REASONS.map((r) => (
                        <Select.Item key={r} value={r}>
                          {r}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                {/* Notes are optional until the reason is "Other", which is not
                    a reason — it is a promise to write one. */}
                <div className="flex flex-col" style={{ gap: 6 }}>
                  <span className="type-body-medium" style={{ color: "#181A1B" }}>
                    Notes{notesRequired ? "" : " (optional)"}
                  </span>
                  <Textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      notesRequired
                        ? "Say what this is, so the next planner does not have to guess"
                        : "Anything the audit log should carry"
                    }
                    aria-label="Override notes"
                  />
                </div>

                <p className="type-caption font-normal" style={{ color: "var(--ds-text-secondary)" }}>
                  This product · branch joins the exception list, and the monthly
                  re-classification will skip it until the override is rolled back.
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex shrink-0 items-center justify-end gap-2"
          style={{ padding: "12px 24px", borderTop: "1px solid #E4E5E7" }}
        >
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="christy"
            size="sm"
            disabled={confirmDisabled}
            onClick={() => onConfirm(choice, revertingToSystem ? "" : auditReason)}
          >
            {revertingToSystem ? "Roll back" : "Override policy"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
