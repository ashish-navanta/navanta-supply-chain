"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardText,
  MagnifyingGlass,
  Prohibit,
  Warning,
} from "@phosphor-icons/react";
import {
  AiStar,
  Button,
  Dropzone,
  Input,
  PanelAlert,
  Pill,
  Select,
  Textarea,
  type DropzoneFile,
} from "@navanta-ai/design-system";
import { Modal } from "@/components/ui/Modal";
import { DetailCard, DetailItem, DetailSection } from "@/components/chat/DetailGrid";
import type { CommitReport } from "@/components/chat/commit";
import {
  CLAIM_TYPES,
  ORDERS,
  formatUsd,
  type ClaimKind,
  type ClaimTypeDef,
  type ServiceOrder,
} from "@/data/service";

/**
 * Filing a claim, in three steps: find the delivery, describe what went wrong,
 * read what the agent will do about it.
 *
 * Ported in shape from the Navanta portal's NewClaimModal and adapted to
 * flooring. That wizard identifies a product by serial number; a unit of LVP
 * has no serial. Target's identifiers are the ones already on the record — the
 * order, the goods receipt, and the batch — so step one looks up a delivery
 * and step two claims against its lines.
 *
 * The other change is what the agent does. In the reference Christy only
 * validates the photographs; here she also adjudicates, because the queue
 * already promises that ("Claim built from the order and receipt · $5K credit
 * for approval"). The wizard has to deliver the same thing.
 */

const STEPS = ["Find the delivery", "Describe the claim", "Review & submit"] as const;

/** Days between two "8 Aug"-style dates, for the eligibility windows. Same
 *  month-table arithmetic the decision modal uses; the fixtures are all inside
 *  one season so a year is never needed. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function dayOfYear(date: string): number | null {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})$/.exec(date.trim());
  if (!m) return null;
  const mi = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  if (mi < 0) return null;
  return CUMULATIVE[mi] + parseInt(m[1], 10);
}

/** Today, as the fixtures date it. The whole prototype is set on this day. */
const TODAY = "21 Aug";

function daysSinceDelivery(order: ServiceOrder): number | null {
  const from = order.deliveredOn ? dayOfYear(order.deliveredOn) : null;
  const to = dayOfYear(TODAY);
  return from === null || to === null ? null : to - from;
}

interface Eligibility {
  eligible: boolean;
  /** Why not, or how long is left. */
  reason: string;
}

/**
 * Whether a claim type can still be filed against this delivery, and why.
 *
 * An ineligible type stays on screen with its reason rather than disappearing:
 * "the concealed-damage window closed 11 days ago" is an answer Daniela can
 * give the account, and a missing option is not.
 */
function eligibilityFor(type: ClaimTypeDef, order: ServiceOrder): Eligibility {
  const elapsed = daysSinceDelivery(order);
  if (elapsed === null) {
    return { eligible: false, reason: "No delivery date on the receipt" };
  }
  if (type.id === "shortage" && !order.shortPallets) {
    return {
      eligible: true,
      reason: `Receipt is signed complete — a shortage claim will need the tailgate count · ${type.windowDays - elapsed} days left`,
    };
  }
  const left = type.windowDays - elapsed;
  if (left < 0) {
    return {
      eligible: false,
      reason: `${type.windowDays}-day window closed ${Math.abs(left)} days ago`,
    };
  }
  return { eligible: true, reason: `${left} of ${type.windowDays} days left to file` };
}

/**
 * What the agent will adjudicate. Pro-rated from the order's own line value, so
 * the figure in the wizard is derived from the same record the claim is filed
 * against rather than typed in.
 */
function adjudicate(order: ServiceOrder, units: number, kind: ClaimKind) {
  const perPallet = order.value / order.units;
  /* A batch mismatch is usually half credit — the material is in spec and
     usable where the match does not show. Everything else is full value. */
  const rate = kind === "wrong-style" ? 0.5 : 1;
  const credit = Math.round(perPallet * units * rate);
  /* The cap scales with the claim rather than being a magic number, and lands on
     the same order of magnitude as the caps already on the queue's claims. */
  const cap = Math.round((perPallet * order.units * 0.08) / 500) * 500;
  return { credit, cap, perPallet: Math.round(perPallet), halfRate: rate === 0.5 };
}

export interface ClaimWizardProps {
  /** Pre-selected when opened from an order; otherwise the wizard starts on lookup. */
  order?: ServiceOrder;
  agent: string;
  onClose: () => void;
  onSubmitted: (report: CommitReport) => void;
}

export function ClaimWizard({ order: initialOrder, agent, onClose, onSubmitted }: ClaimWizardProps) {
  /* Opening from an order skips step one — the delivery is already identified,
     and asking someone to look up the record they just came from is theatre. */
  const [step, setStep] = useState(initialOrder ? 1 : 0);

  // ── Step 1 · find the delivery ────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [order, setOrder] = useState<ServiceOrder | null>(initialOrder ?? null);

  /** Deliveries that can be claimed against — receipted ones. */
  const receipted = useMemo(() => ORDERS.filter((o) => o.receipt), []);

  const lookup = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = receipted.find(
      (o) =>
        o.id.toLowerCase() === q ||
        o.receipt?.toLowerCase() === q ||
        o.account.toLowerCase().includes(q),
    );
    if (hit) {
      setOrder(hit);
      setLookupError("");
    } else {
      setOrder(null);
      setLookupError(
        `No receipted delivery matches "${query.trim()}". Try an order number, a goods receipt, or the account's name.`,
      );
    }
  };

  // ── Step 2 · describe the claim ───────────────────────────────────────────
  const [kind, setKind] = useState<ClaimKind | null>(null);
  const [units, setPallets] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<DropzoneFile[]>([]);
  /** Christy's evidence check — idle until asked, then pass or warn. */
  const [checked, setChecked] = useState<"idle" | "pass" | "warn">("idle");

  const type = kind ? (CLAIM_TYPES.find((t) => t.id === kind) ?? null) : null;
  const palletNum = Number.parseInt(units, 10);
  const palletsValid =
    Number.isFinite(palletNum) && palletNum > 0 && order !== null && palletNum <= order.units;

  const canDescribe =
    order !== null &&
    type !== null &&
    palletsValid &&
    description.trim().length > 0 &&
    (!type.needsPhotos || files.length > 0);

  const assessment = order && kind && palletsValid ? adjudicate(order, palletNum, kind) : null;
  const overCap = assessment ? assessment.credit > assessment.cap : false;

  const submit = () => {
    if (!order || !type || !assessment) return;
    onSubmitted({
      title: `Claim filed against ${order.id}`,
      message:
        `${type.label} on ${palletNum} ${palletNum === 1 ? "unit" : "units"}, against ${order.receipt}. ` +
        `${agent} adjudicated ${formatUsd(assessment.credit)}` +
        (assessment.halfRate ? " at half credit — the lot is in spec and usable" : "") +
        (overCap
          ? ` — over the ${formatUsd(assessment.cap)} cap, so it needs a second signature.`
          : ` and it sits inside the ${formatUsd(assessment.cap)} cap.`) +
        ` It is now in your action center for approval.`,
    });
  };

  const stepValid = step === 0 ? order !== null : step === 1 ? canDescribe : true;

  return (
    <Modal
      title="File a claim"
      size="xwide"
      fixedHeight={720}
      onClose={onClose}
      headerContent={
        <div className="flex min-w-0 items-center" style={{ gap: 10 }}>
          <ClipboardText size={18} weight="duotone" style={{ color: "var(--text-primary)" }} />
          <span className="type-title" style={{ color: "var(--ds-text-primary)" }}>
            File a claim
          </span>
          {/* The step rail. The DS has no wizard shell, so the steps ride in the
              modal header where the title would otherwise sit alone. */}
          <span className="flex flex-wrap items-center" style={{ gap: 6 }}>
            {STEPS.map((label, i) => (
              <span key={label} className="flex items-center" style={{ gap: 6 }}>
                {i > 0 && (
                  <span aria-hidden="true" style={{ width: 12, height: 1, background: "var(--ds-border-default)" }} />
                )}
                <Pill variant={i === step ? "info" : "neutral"} size="sm">
                  {`${i + 1}. ${label}`}
                </Pill>
              </span>
            ))}
          </span>
        </div>
      }
      footer={
        <>
          <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
            {step === 0
              ? "A claim is filed against a receipted delivery, not against an order."
              : step === 1
                ? type?.needsPhotos && files.length === 0
                  ? `${type.label} needs at least one photograph`
                  : `${agent} adjudicates from the order and the receipt — you are not typing a credit.`
                : `Submitting puts this in your action center for approval.`}
          </span>
          <span className="flex items-center" style={{ gap: 8 }}>
            {step > 0 && (
              <Button
                variant="outline"
                size="sm"
                iconLeft={<ArrowLeft size={14} />}
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button
                variant="christy"
                size="sm"
                iconRight={<ArrowRight size={14} />}
                disabled={!stepValid}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="christy"
                size="sm"
                iconLeft={<Check size={14} weight="bold" />}
                onClick={submit}
              >
                {assessment ? `Submit · ${formatUsd(assessment.credit)}` : "Submit claim"}
              </Button>
            )}
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        {/* ── Step 1 ─────────────────────────────────────────────────────── */}
        {step === 0 && (
          <>
            <div className="flex flex-col gap-2">
              <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                Order number, goods receipt or account
              </span>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") lookup();
                    }}
                    placeholder="SO-4529, GR-4471-02, Gulf Coast Jewelers…"
                    aria-label="Find the delivery"
                  />
                </div>
                <Button
                  variant="outline"
                  iconLeft={<MagnifyingGlass size={14} />}
                  onClick={lookup}
                  disabled={query.trim().length === 0}
                >
                  Find
                </Button>
              </div>
              {lookupError && (
                <PanelAlert type="warning" title="Not found" description={lookupError} />
              )}
            </div>

            {order ? (
              <DetailCard>
                <DetailSection title="The delivery">
                  <DetailItem label="Order" value={order.id} source="SAP ECC" />
                  <DetailItem label="Account" value={order.account} source="Customer master" />
                  <DetailItem label="Goods receipt" value={order.receipt ?? "—"} source="SAP WM" />
                  <DetailItem label="Delivered" value={order.deliveredOn ?? "—"} source="DC appointment book · POD" />
                  <DetailItem label="Quantity" value={`${order.units} units`} source="SAP ECC" />
                  <DetailItem label="Order value" value={formatUsd(order.value)} source="SAP ECC" />
                  <DetailItem label="Carrier" value={order.carrier} source="SAP WM" />
                  <DetailItem
                    label="On the receipt"
                    value={
                      order.shortPallets
                        ? `${order.shortPallets} units short or damaged`
                        : "Signed complete"
                    }
                    source="SAP WM · receiving"
                  />
                </DetailSection>
                <DetailSection title="Lines on the delivery" columns={1}>
                  <ul className="flex flex-col">
                    {order.lines.map((l, i) => (
                      <li
                        key={l.sku}
                        className="flex items-center gap-3 py-2"
                        style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="ds-body-medium truncate" style={{ color: "var(--ds-text-primary)" }}>
                            {l.style}
                          </span>
                          <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                            {`SKU ${l.sku} · batch ${l.dyeLot}`}
                          </span>
                        </span>
                        <span
                          className="ds-body-medium shrink-0"
                          style={{ color: "var(--ds-text-primary)", fontVariantNumeric: "tabular-nums" }}
                        >
                          {`${l.units} units`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              </DetailCard>
            ) : (
              <div
                className="flex flex-col gap-2 rounded-xl p-4"
                style={{ background: "var(--surface-sunken)" }}
              >
                <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                  Receipted deliveries you can claim against
                </span>
                <ul className="flex flex-wrap" style={{ gap: 8 }}>
                  {receipted.map((o) => (
                    <li key={o.id}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setOrder(o);
                          setQuery(o.id);
                          setLookupError("");
                        }}
                      >
                        {`${o.id} · ${o.account}`}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* ── Step 2 ─────────────────────────────────────────────────────── */}
        {step === 1 && order && (
          <>
            <div className="flex flex-col gap-2">
              <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                {`What went wrong · delivered ${order.deliveredOn} on ${order.receipt}`}
              </span>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(1, minmax(0,1fr))" }}>
                {CLAIM_TYPES.map((t) => {
                  const el = eligibilityFor(t, order);
                  const picked = kind === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!el.eligible}
                      aria-pressed={picked}
                      onClick={() => {
                        setKind(t.id);
                        setChecked("idle");
                      }}
                      className="flex items-start gap-3 rounded-lg p-3 text-left transition-colors disabled:cursor-not-allowed"
                      style={{
                        background: el.eligible ? "var(--surface-base)" : "var(--surface-sunken)",
                        border: `1px solid ${picked ? "var(--ds-border-interactive)" : "var(--ds-border-default)"}`,
                        opacity: el.eligible ? 1 : 0.7,
                      }}
                    >
                      <span className="mt-0.5 shrink-0">
                        {el.eligible ? (
                          <span
                            aria-hidden="true"
                            className="flex h-4 w-4 items-center justify-center rounded-full"
                            style={{
                              border: `1px solid ${picked ? "var(--color-iris-700)" : "var(--ds-border-strong, #d4d4d8)"}`,
                              background: picked ? "var(--color-iris-700)" : "transparent",
                            }}
                          >
                            {picked && <Check size={10} weight="bold" color="#fff" />}
                          </span>
                        ) : (
                          <Prohibit size={16} style={{ color: "var(--text-muted)" }} />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                          {t.label}
                        </span>
                        <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                          {t.description}
                        </span>
                      </span>
                      <Pill variant={el.eligible ? "neutral" : "warning"} size="sm">
                        {el.reason}
                      </Pill>
                    </button>
                  );
                })}
              </div>
            </div>

            {type && (
              <>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex flex-col gap-1" style={{ width: 200 }}>
                    <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                      {`Pallets affected (of ${order.units})`}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      max={order.units}
                      value={units}
                      onChange={(e) => setPallets(e.target.value)}
                      placeholder={String(order.shortPallets ?? 1)}
                      aria-label="Pallets affected"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1" style={{ minWidth: 220 }}>
                    <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                      Dye lot
                    </span>
                    <Select defaultValue={order.lines[0]?.dyeLot}>
                      <Select.Trigger size="md" aria-label="Batch">
                        <Select.Value placeholder="Dye lot" />
                      </Select.Trigger>
                      <Select.Content>
                        {order.lines.map((l) => (
                          <Select.Item key={l.sku} value={l.dyeLot}>
                            {`${l.dyeLot} — ${l.style}`}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                    What the account reported
                  </span>
                  <Textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Two units crushed under the wrap, found at the tailgate before the driver left…"
                    aria-label="What the account reported"
                  />
                </div>

                {type.needsPhotos && (
                  <div className="flex flex-col gap-2">
                    <Dropzone
                      multiple
                      accept="image/*,application/pdf"
                      label="Photographs"
                      description="Tailgate photos, the unit label, and the signed receipt"
                      files={files}
                      onFilesAdded={(added) =>
                        setFiles((prev) => [
                          ...prev,
                          /* DropzoneFile is `{ file, id }` — the component reads
                             name and size off the File itself. */
                          ...added.map((file, i) => ({ file, id: `${file.name}-${prev.length + i}` })),
                        ])
                      }
                      onFileRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
                    />

                    {/* The reference portal's evidence check, kept — it is the one
                        place a photograph can be rejected before the account has
                        been told the claim is in. */}
                    {files.length > 0 && checked === "idle" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        iconLeft={<AiStar size={14} variant="small" />}
                        onClick={() => setChecked(files.length >= 2 ? "pass" : "warn")}
                      >
                        {`Have ${agent} check the evidence`}
                      </Button>
                    )}
                    {checked === "pass" && (
                      <PanelAlert
                        type="success"
                        title={`${agent} checked the evidence`}
                        description="Damage is visible, the unit label is legible and the receipt matches. Nothing else needed."
                      />
                    )}
                    {checked === "warn" && (
                      <PanelAlert
                        type="warning"
                        title={`${agent} wants one more photograph`}
                        description="One image shows the damage but not the unit label, so the batch cannot be confirmed from the evidence. The claim can still be filed."
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Step 3 ─────────────────────────────────────────────────────── */}
        {step === 2 && order && type && assessment && (
          <>
            <div
              className="flex flex-col gap-3 overflow-hidden rounded-xl p-4"
              style={{ background: "var(--color-iris-50)" }}
            >
              <span className="flex items-center gap-2">
                <AiStar size={16} variant="small" />
                <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                  {`${agent} adjudicated this from the order and the receipt`}
                </span>
              </span>
              <p className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
                {`${palletNum} of ${order.units} units at ${formatUsd(assessment.perPallet)} a unit` +
                  `${assessment.halfRate ? ", at half credit — a batch mismatch leaves the material in spec and usable where the match does not show" : ""}` +
                  ` comes to ${formatUsd(assessment.credit)}, against a ${formatUsd(assessment.cap)} policy cap.` +
                  (overCap
                    ? " That is over the cap, so it needs a second signature before the credit note is raised."
                    : " One signature clears it.")}
              </p>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                {[
                  { label: "Credit", value: formatUsd(assessment.credit) },
                  { label: "Policy cap", value: formatUsd(assessment.cap) },
                  { label: "Evidence", value: `${files.length} ${files.length === 1 ? "file" : "files"}` },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="flex flex-col gap-1 rounded-lg p-2"
                    style={{ background: "var(--surface-base)", border: "1px solid var(--color-iris-200)" }}
                  >
                    <span className="ds-label" style={{ color: "var(--ds-text-secondary)" }}>
                      {f.label}
                    </span>
                    <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {overCap && (
              <PanelAlert
                type="warning"
                title="Over the policy cap"
                description={`${formatUsd(assessment.credit)} exceeds the ${formatUsd(assessment.cap)} cap for this order. It can be filed now; approval needs a second signature.`}
              />
            )}
            {checked === "warn" && (
              <PanelAlert
                type="info"
                title="Evidence is thin but sufficient"
                description={`${agent} could not confirm the batch from the photographs. Filing anyway is fine — it may come back for one more image.`}
              />
            )}

            <DetailCard>
              <DetailSection title="What is being filed">
                <DetailItem label="Claim type" value={type.label} source="Selected by you" />
                <DetailItem
                  label="Against"
                  value={`${order.id} · ${order.receipt}`}
                  source="SAP ECC · SAP WM"
                />
                <DetailItem label="Account" value={order.account} source="Customer master" />
                <DetailItem
                  label="Pallets"
                  value={`${palletNum} of ${order.units}`}
                  source="Entered by you"
                />
                <DetailItem label="Batch" value={order.lines[0]?.dyeLot ?? "—"} source="Line item" />
                <DetailItem
                  label="Filing window"
                  value={eligibilityFor(type, order).reason}
                  source={`${type.windowDays} days from delivery`}
                />
              </DetailSection>
              <DetailSection title="What was reported" columns={1}>
                <span className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
                  {description}
                </span>
              </DetailSection>
            </DetailCard>
          </>
        )}

        {/* A guard rather than a blank screen — reachable only if a pre-selected
            order arrives without a receipt. */}
        {step > 0 && !order && (
          <PanelAlert
            type="warning"
            title="No delivery selected"
            description="Go back and find the delivery this claim is filed against."
          />
        )}
        {step === 1 && order && !type && (
          <span className="flex items-center gap-2 ds-label" style={{ color: "var(--text-muted)" }}>
            <Warning size={14} />
            Pick a claim type to carry on.
          </span>
        )}
      </div>
    </Modal>
  );
}
