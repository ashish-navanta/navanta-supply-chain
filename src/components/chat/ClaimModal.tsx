"use client";

import { useMemo, useState } from "react";
import {
  ChatsCircle,
  ClockCounterClockwise,
  Receipt,
  SealWarning,
} from "@phosphor-icons/react";
import { Button, Pill, Tabs } from "@navanta-ai/design-system";
import { Modal, type ModalProps } from "@/components/ui/Modal";
import { ActivityHistory } from "@/components/chat/ActivityHistory";
import { AgentSummary } from "@/components/chat/AgentSummary";
import { ChoiceSection } from "@/components/chat/ChoiceSection";
import { DetailCard, DetailItem, DetailSection } from "@/components/chat/DetailGrid";
import { EmailThread } from "@/components/chat/EmailThread";
import { CREDIT_REASONS, OverridePanel } from "@/components/chat/OverridePanel";
import { claimCommit, type CommitReport } from "@/components/chat/commit";
import { formatUsd, historyFor, threadFor, type ActionRow } from "@/data/action-center";

/**
 * The service rep's decision on a damage claim.
 *
 * The agent has already assembled the case from records Target holds — the order,
 * the delivery receipt, the batch, the tailgate photographs — and adjudicated a
 * credit. What is left is releasing it, or correcting the figure with a reason on
 * record. Nothing here is about a lead time: this seat is settling a claim, and
 * framing it as a supplier approval was simply the wrong screen.
 */

/** Credit is stepped in round money rather than to the cent. */
const CREDIT_STEP = 100;

function confidenceFor(row: ActionRow): number {
  const c = row.claim;
  if (!c) return 70;
  // Photographs plus a matching receipt is the strong case; either missing is not.
  return c.photos >= 4 ? 93 : 81;
}

export interface ClaimModalProps {
  row: ActionRow;
  agent: string;
  signer: string;
  nav?: ModalProps["nav"];
  onClose: () => void;
  onCommitted: (report: CommitReport) => void;
  initialOverriding?: boolean;
}

export function ClaimModal({
  row,
  agent,
  nav,
  onClose,
  onCommitted,
  initialOverriding = false,
}: ClaimModalProps) {
  const claim = row.claim;
  const recommended = claim?.credit ?? 0;

  const [credit, setCredit] = useState(String(recommended));
  const [overriding, setOverriding] = useState(initialOverriding);
  const [reason, setReason] = useState<string | null>(null);

  type Panel = "claim" | "thread" | "history";
  const [panel, setPanel] = useState<Panel>("claim");

  const num = Number.parseInt(credit, 10);
  const valid = Number.isFinite(num) && num > 0;
  const overCap = valid && claim ? num > claim.policyCap : false;
  const settled = row.state === "settled";

  const history = useMemo(() => historyFor(row, agent), [row, agent]);
  const thread = useMemo(() => threadFor(row, agent), [row, agent]);

  const commit = () => onCommitted(claimCommit(row, agent, num, reason));

  return (
    <Modal
      title={`${row.ref} — ${settled ? "review" : "claim"}`}
      size="xxwide"
      fixedHeight={760}
      nav={nav}
      onClose={onClose}
      headerContent={
        <div className="flex items-center" style={{ gap: 10 }}>
          <SealWarning size={18} weight="duotone" style={{ color: "var(--text-primary)" }} />
          <span className="type-title" style={{ color: "var(--ds-text-primary)" }}>
            {row.ref}
          </span>
          <Pill variant="info" size="sm">
            {row.party}
          </Pill>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <AgentSummary
          agent={agent}
          text={
            settled
              ? `Settled. The credit was issued against ${claim?.receipt ?? "the receipt"}, the invoice corrected and ${row.party} made whole.`
              : `${agent} built this claim from the order, the delivery receipt and ${claim?.photos ?? 0} photographs taken at the tailgate, and adjudicated ${formatUsd(recommended)} against ${claim?.damagedUnits ?? 0} damaged ${row.qtyUnit}. It sits inside the ${formatUsd(claim?.policyCap ?? 0)} policy limit. What is left is releasing it.`
          }
          facts={[
            { label: "Damaged", value: `${claim?.damagedUnits ?? 0} ${row.qtyUnit}` },
            {
              label: "Credit",
              value: formatUsd(recommended),
              next: !settled && valid && num !== recommended ? formatUsd(num) : undefined,
            },
            { label: "Photographs", value: String(claim?.photos ?? 0) },
            { label: "Delivered", value: claim?.deliveredOn ?? row.date },
            { label: "Policy limit", value: formatUsd(claim?.policyCap ?? 0) },
          ]}
        >
          {settled ? null : overriding ? (
            <OverridePanel
              agent={agent}
              subject="credit"
              unit="dollars"
              reasons={CREDIT_REASONS}
              value={credit}
              onValueChange={setCredit}
              recommended={recommended}
              step={CREDIT_STEP}
              reason={reason}
              onReasonChange={setReason}
              valid={valid && !overCap}
              onCancel={() => {
                setOverriding(false);
                setReason(null);
                setCredit(String(recommended));
              }}
              onConfirm={commit}
            />
          ) : (
            <ChoiceSection
              name={`claim-${row.id}`}
              ariaLabel="Settle the claim"
              requireChoice={false}
              recommendation={{
                line: `Issue a ${formatUsd(valid ? num : recommended)} credit to ${row.party}`,
                confidence: confidenceFor(row),
              }}
              onCancel={onClose}
              confirmLabel={`Issue · ${formatUsd(valid ? num : recommended)}`}
              onConfirm={commit}
              actions={
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={<Receipt size={14} />}
                    onClick={() => setOverriding(true)}
                  >
                    Override credit
                  </Button>
                  <Button
                    size="sm"
                    variant="christy"
                    disabled={!valid || overCap}
                    onClick={commit}
                  >
                    {`Issue · ${formatUsd(valid ? num : recommended)}`}
                  </Button>
                </>
              }
            />
          )}
        </AgentSummary>

        <Tabs
          variant="underline"
          className="border-b border-[color:var(--ds-border-subtle)]"
          tabs={[
            { id: "claim", label: "Claim details", icon: Receipt },
            { id: "thread", label: "Email & call thread", icon: ChatsCircle, badge: thread.length },
            {
              id: "history",
              label: "Activity history",
              icon: ClockCounterClockwise,
              badge: history.length,
            },
          ]}
          activeTab={panel}
          onChange={(id) => setPanel(id as Panel)}
        />

        {panel === "claim" ? (
          <DetailCard>
            <DetailSection title="The claim">
              <DetailItem label="Claim" value={row.ref} source="SAP ECC" />
              <DetailItem label="Account" value={row.party} source="Customer master" />
              <DetailItem
                label="Damaged"
                value={`${claim?.damagedUnits ?? 0} ${row.qtyUnit}`}
                source={`${agent} · tailgate photographs`}
              />
              <DetailItem label="Product" value={row.product} source="Item master" />
              <DetailItem
                label="Delivery receipt"
                value={claim?.receipt ?? "—"}
                source="SAP WM · WMS"
              />
              <DetailItem label="Batch" value={claim?.batch ?? "—"} source="Item master" />
              <DetailItem
                label="Delivered"
                value={claim?.deliveredOn ?? row.date}
                source="SAP WM · proof of delivery"
              />
            </DetailSection>

            <DetailSection title="Adjudication">
              <DetailItem
                label="Assessed credit"
                value={formatUsd(recommended)}
                source={`${agent} · order value and batch cost`}
              />
              <DetailItem
                label="Policy limit"
                value={formatUsd(claim?.policyCap ?? 0)}
                source="Claims policy"
              />
              <DetailItem
                label="Within policy"
                value={overCap ? "No — needs a second signature" : "Yes"}
                source="Claims policy"
              />
              {valid && num !== recommended && (
                <DetailItem
                  label="Your figure"
                  value={`${formatUsd(num)} · not yet issued`}
                  source="This session"
                />
              )}
            </DetailSection>
          </DetailCard>
        ) : panel === "thread" ? (
          <EmailThread row={row} agent={agent} />
        ) : (
          <ActivityHistory row={row} agent={agent} />
        )}
      </div>
    </Modal>
  );
}
