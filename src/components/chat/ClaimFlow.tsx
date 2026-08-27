"use client";

import { useState } from "react";
import { ArrowRight, Check, MagnifyingGlass, Prohibit } from "@phosphor-icons/react";
import {
  AiStar,
  Button,
  Dropzone,
  Input,
  PanelAlert,
  Pill,
  Textarea,
  type DropzoneFile,
} from "@navanta-ai/design-system";
import {
  CLAIM_TYPES,
  formatUsd,
  type ClaimKind,
  type ServiceOrder,
} from "@/data/service";
import {
  adjudicate,
  claimTypeFor,
  eligibilityFor,
  lookupDelivery,
  receiptedOrders,
  type Assessment,
} from "@/lib/claim";

/**
 * Filing a claim inside the chat, as a run of cards in the conversation.
 *
 * The same three moves the modal wizard made — find the delivery, describe what
 * went wrong, read what the agent adjudicated — but each one arrives as the
 * agent's next turn rather than as a step rail in a dialog. The rules are shared
 * with `lib/claim.ts`, so the window and the credit are the wizard's.
 *
 * Every card is 348px at most: the panel is 380px wide with 16px of padding
 * either side, and anything wider clips rather than wraps.
 */

/** Where the flow is. Each value names the card the agent has just put up. */
export type ClaimStep = "identify" | "type" | "details" | "evidence" | "review" | "filed";

export interface ClaimFlowState {
  step: ClaimStep;
  order: ServiceOrder | null;
  kind: ClaimKind | null;
  units: string;
  description: string;
  files: DropzoneFile[];
  /** The agent's evidence check — idle until asked, then pass or warn. */
  checked: "idle" | "pass" | "warn";
}

export function initialClaimState(order?: ServiceOrder): ClaimFlowState {
  return {
    /* An order arrives already identified when the flow started from its row —
       asking someone to look up the record they just clicked is theatre. */
    step: order ? "type" : "identify",
    order: order ?? null,
    kind: null,
    units: "",
    description: "",
    files: [],
    checked: "idle",
  };
}

/** The assessment for the current state, or null while it is not yet decidable. */
export function assessmentFor(state: ClaimFlowState): Assessment | null {
  const n = Number.parseInt(state.units, 10);
  if (!state.order || !state.kind) return null;
  if (!Number.isFinite(n) || n < 1 || n > state.order.units) return null;
  return adjudicate(state.order, n, state.kind);
}

/* ── Card shell ──────────────────────────────────────────────────────────── */

/** The container every flow card sits in. `spent` greys a card the flow has
 *  moved past, so the transcript reads as history rather than as six live
 *  forms competing for the next click. */
function Card({
  title,
  spent,
  children,
}: {
  title: string;
  spent: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="w-full overflow-hidden rounded-[12px]"
      style={{
        background: "var(--surface-base)",
        border: "1px solid var(--ds-border-default)",
        boxShadow: "0px 0.5px 2px 0px rgba(0,0,0,0.15)",
        opacity: spent ? 0.6 : 1,
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid var(--ds-border-subtle)", background: "var(--surface-sunken)" }}
      >
        <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
          {title}
        </span>
        {spent && <Check size={12} weight="bold" style={{ color: "var(--ds-text-secondary)" }} />}
      </div>
      <div className="flex flex-col gap-2.5 px-3 py-3">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
      {children}
    </span>
  );
}

/* ── Step 1 · find the delivery ──────────────────────────────────────────── */

export function IdentifyCard({
  spent,
  onResolved,
}: {
  spent: boolean;
  onResolved: (order: ServiceOrder) => void;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const receipted = receiptedOrders();

  const find = () => {
    const hit = lookupDelivery(query);
    if (hit) {
      setError("");
      onResolved(hit);
    } else {
      setError(
        `No receipted delivery matches "${query.trim()}". Try an order number, a goods receipt, or the account's name.`,
      );
    }
  };

  return (
    <Card title="Find the delivery" spent={spent}>
      <FieldLabel>Order number, goods receipt or account</FieldLabel>
      <Input
        value={query}
        disabled={spent}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") find();
        }}
        placeholder="SO-4529, GR-4471-02…"
        aria-label="Find the delivery"
      />
      <Button
        variant="outline"
        size="sm"
        fullWidth
        disabled={spent || query.trim().length === 0}
        iconLeft={<MagnifyingGlass size={14} />}
        onClick={find}
      >
        Find
      </Button>
      {error && !spent && <PanelAlert type="warning" title="Not found" description={error} />}

      {!spent && (
        <>
          <FieldLabel>Or pick a receipted delivery</FieldLabel>
          <div className="flex flex-col gap-1.5">
            {receipted.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onResolved(o)}
                className="flex flex-col rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                style={{ border: "1px solid var(--ds-border-subtle)" }}
              >
                <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                  {o.id}
                </span>
                <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                  {`${o.account} · ${o.units} units · ${o.receipt}`}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* ── The identified delivery, as a read-back ─────────────────────────────── */

export function DeliveryCard({ order }: { order: ServiceOrder }) {
  const rows: [string, string][] = [
    ["Account", order.account],
    ["Goods receipt", order.receipt ?? "—"],
    ["Delivered", order.deliveredOn ?? "—"],
    ["Quantity", `${order.units} units`],
    ["Order value", formatUsd(order.value)],
    [
      "On the receipt",
      order.shortPallets ? `${order.shortPallets} units short or damaged` : "Signed complete",
    ],
  ];
  return (
    <Card title={order.id} spent={false}>
      <div className="flex flex-col">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 py-1.5"
            style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
          >
            <span className="ds-label shrink-0" style={{ color: "var(--ds-text-secondary)" }}>
              {label}
            </span>
            <span
              className="ds-body-medium text-right"
              style={{ color: "var(--ds-text-primary)", fontVariantNumeric: "tabular-nums" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── Step 2a · claim type ────────────────────────────────────────────────── */

export function TypeCard({
  order,
  picked,
  spent,
  onPick,
}: {
  order: ServiceOrder;
  picked: ClaimKind | null;
  spent: boolean;
  onPick: (kind: ClaimKind) => void;
}) {
  return (
    <Card title="What went wrong" spent={spent}>
      {CLAIM_TYPES.map((t) => {
        const el = eligibilityFor(t, order);
        const isPicked = picked === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={!el.eligible || spent}
            aria-pressed={isPicked}
            onClick={() => onPick(t.id)}
            className="flex flex-col gap-1 rounded-lg px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed"
            style={{
              background: el.eligible ? "var(--surface-base)" : "var(--surface-sunken)",
              border: `1px solid ${isPicked ? "var(--ds-border-interactive)" : "var(--ds-border-default)"}`,
              opacity: el.eligible ? 1 : 0.7,
            }}
          >
            <span className="flex items-center gap-2">
              {el.eligible ? (
                <span
                  aria-hidden="true"
                  className="flex size-4 shrink-0 items-center justify-center rounded-full"
                  style={{
                    border: `1px solid ${isPicked ? "var(--color-iris-700)" : "var(--ds-border-strong, #d4d4d8)"}`,
                    background: isPicked ? "var(--color-iris-700)" : "transparent",
                  }}
                >
                  {isPicked && <Check size={10} weight="bold" color="#fff" />}
                </span>
              ) : (
                <Prohibit size={14} className="shrink-0" style={{ color: "var(--text-muted)" }} />
              )}
              <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                {t.label}
              </span>
            </span>
            <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
              {t.description}
            </span>
            <Pill variant={el.eligible ? "neutral" : "warning"} size="sm">
              {el.reason}
            </Pill>
          </button>
        );
      })}
    </Card>
  );
}

/* ── Step 2b · units, batch and what was reported ────────────────────── */

export function DetailsCard({
  order,
  units,
  description,
  spent,
  onChangePallets,
  onChangeDescription,
  onContinue,
}: {
  order: ServiceOrder;
  units: string;
  description: string;
  spent: boolean;
  onChangePallets: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onContinue: () => void;
}) {
  const n = Number.parseInt(units, 10);
  const palletsValid = Number.isFinite(n) && n > 0 && n <= order.units;
  const ready = palletsValid && description.trim().length > 0;

  return (
    <Card title="The damage" spent={spent}>
      <FieldLabel>{`Pallets affected (of ${order.units})`}</FieldLabel>
      <Input
        type="number"
        min={1}
        max={order.units}
        disabled={spent}
        value={units}
        onChange={(e) => onChangePallets(e.target.value)}
        placeholder={String(order.shortPallets ?? 1)}
        aria-label="Pallets affected"
      />
      {units.trim().length > 0 && !palletsValid && !spent && (
        <PanelAlert
          type="warning"
          title="Check the count"
          description={`The delivery is ${order.units} units, so the claim cannot be for more than that.`}
        />
      )}

      <FieldLabel>What the account reported</FieldLabel>
      <Textarea
        rows={3}
        disabled={spent}
        value={description}
        onChange={(e) => onChangeDescription(e.target.value)}
        placeholder="Two units crushed under the wrap, found at the tailgate…"
        aria-label="What the account reported"
      />

      {!spent && (
        <Button
          variant="christy"
          size="sm"
          fullWidth
          disabled={!ready}
          iconRight={<ArrowRight size={14} />}
          onClick={onContinue}
        >
          Continue
        </Button>
      )}
    </Card>
  );
}

/* ── Step 2c · evidence ──────────────────────────────────────────────────── */

export function EvidenceCard({
  agent,
  needsPhotos,
  files,
  checked,
  spent,
  onFilesAdded,
  onFileRemove,
  onCheck,
  onContinue,
}: {
  agent: string;
  needsPhotos: boolean;
  files: DropzoneFile[];
  checked: "idle" | "pass" | "warn";
  spent: boolean;
  onFilesAdded: (files: File[]) => void;
  onFileRemove: (id: string) => void;
  onCheck: () => void;
  onContinue: () => void;
}) {
  return (
    <Card title="Evidence" spent={spent}>
      <Dropzone
        multiple
        accept="image/*,application/pdf"
        label="Photographs"
        description="Tailgate photos, the unit label, the signed receipt"
        files={files}
        onFilesAdded={onFilesAdded}
        onFileRemove={onFileRemove}
      />

      {files.length > 0 && checked === "idle" && !spent && (
        <Button
          variant="outline"
          size="sm"
          fullWidth
          iconLeft={<AiStar size={14} variant="small" />}
          onClick={onCheck}
        >
          {`Have ${agent} check the evidence`}
        </Button>
      )}
      {checked === "pass" && (
        <PanelAlert
          type="success"
          title={`${agent} checked the evidence`}
          description="Damage is visible, the unit label is legible and the receipt matches."
        />
      )}
      {checked === "warn" && (
        <PanelAlert
          type="warning"
          title={`${agent} wants one more photograph`}
          description="One image shows the damage but not the unit label, so the batch cannot be confirmed. The claim can still be filed."
        />
      )}

      {!spent && (
        <Button
          variant="christy"
          size="sm"
          fullWidth
          disabled={needsPhotos && files.length === 0}
          iconRight={<ArrowRight size={14} />}
          onClick={onContinue}
        >
          {needsPhotos && files.length === 0 ? "A photograph is required" : "Continue"}
        </Button>
      )}
    </Card>
  );
}

/* ── Step 3 · what the agent adjudicated ─────────────────────────────────── */

export function ReviewCard({
  order,
  kind,
  units,
  assessment,
  files,
  agent,
  spent,
  onSubmit,
}: {
  order: ServiceOrder;
  kind: ClaimKind;
  units: number;
  assessment: Assessment;
  files: number;
  agent: string;
  spent: boolean;
  onSubmit: () => void;
}) {
  const type = claimTypeFor(kind);
  return (
    <Card title="Review & submit" spent={spent}>
      <div
        className="flex flex-col gap-2 rounded-lg p-2.5"
        style={{ background: "var(--color-iris-50)" }}
      >
        <span className="flex items-center gap-1.5">
          <AiStar size={14} variant="small" />
          <span className="ds-label" style={{ color: "var(--ds-text-primary)" }}>
            {`${agent} adjudicated this from the order and the receipt`}
          </span>
        </span>
        <p className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
          {`${units} of ${order.units} units at ${formatUsd(assessment.perPallet)} a unit` +
            (assessment.halfRate
              ? ", at half credit — a batch mismatch leaves the material in spec and usable where the match does not show"
              : "") +
            ` comes to ${formatUsd(assessment.credit)}, against a ${formatUsd(assessment.cap)} policy cap.` +
            (assessment.overCap
              ? " That is over the cap, so it needs a second signature before the credit note is raised."
              : " One signature clears it.")}
        </p>
      </div>

      <div className="flex flex-col">
        {(
          [
            ["Claim type", type?.label ?? kind],
            ["Against", `${order.id} · ${order.receipt}`],
            ["Account", order.account],
            ["Pallets", `${units} of ${order.units}`],
            ["Credit", formatUsd(assessment.credit)],
            ["Policy cap", formatUsd(assessment.cap)],
            ["Evidence", `${files} ${files === 1 ? "file" : "files"}`],
          ] as [string, string][]
        ).map(([label, value], i) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 py-1.5"
            style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
          >
            <span className="ds-label shrink-0" style={{ color: "var(--ds-text-secondary)" }}>
              {label}
            </span>
            <span
              className="ds-body-medium text-right"
              style={{ color: "var(--ds-text-primary)", fontVariantNumeric: "tabular-nums" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {assessment.overCap && (
        <PanelAlert
          type="warning"
          title="Over the policy cap"
          description={`${formatUsd(assessment.credit)} exceeds the ${formatUsd(assessment.cap)} cap for this order. It can be filed now; approval needs a second signature.`}
        />
      )}

      {!spent && (
        <Button
          variant="christy"
          size="sm"
          fullWidth
          iconLeft={<Check size={14} weight="bold" />}
          onClick={onSubmit}
        >
          {`Submit · ${formatUsd(assessment.credit)}`}
        </Button>
      )}
    </Card>
  );
}

/* ── Filed ───────────────────────────────────────────────────────────────── */

export function FiledCard({
  claimId,
  title,
  message,
  onDone,
}: {
  claimId: string;
  title: string;
  message: string;
  onDone: () => void;
}) {
  return (
    <Card title={claimId} spent={false}>
      <span className="flex items-center gap-1.5">
        <Check size={14} weight="bold" style={{ color: "var(--ds-text-success, #047857)" }} />
        <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
          {title}
        </span>
      </span>
      <p className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
        {message}
      </p>
      <Button variant="outline" size="sm" fullWidth onClick={onDone}>
        Done
      </Button>
    </Card>
  );
}
