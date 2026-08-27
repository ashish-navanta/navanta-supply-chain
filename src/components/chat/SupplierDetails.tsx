"use client";

import { Button } from "@navanta-ai/design-system";
import { Copy } from "@phosphor-icons/react";
import { DetailCard, DetailItem, DetailSection } from "@/components/chat/DetailGrid";
import {
  CAUSE_LABEL,
  causeOf,
  contactFor,
  linesFor,
  type ActionRow,
} from "@/data/action-center";

/**
 * Who the counterparty is, split into the account and the person who answers.
 * Shared by the decision and contact modals so a supplier reads the same on
 * both: supporting context for the call, or the record you are about to ring.
 */
export function SupplierDetails({ row }: { row: ActionRow }) {
  /* On a planner row `party` is the distribution node, and the supplier behind
     the SKU is the one on the coverage policy — that is who the planner would
     call, so prefer it. */
  const party = row.cover?.supplier ?? row.party;
  const own = row.cover ? party.includes("Plant") : row.partyOwn;
  const contact = contactFor(party, own);
  // What the supplier is asking for — named as their request, since nothing
  // reaches the record until the buyer confirms it.
  const requested = Math.max(...linesFor(row).map((l) => l.leadDays));

  return (
    <DetailCard>
      <DetailSection title="The account">
        <DetailItem label="Supplier / Plant" value={party} source="Supplier master" />
        <DetailItem
          label="Relationship"
          value={own ? "Target-dedicated lines" : "External supplier"}
          source="Supplier master"
        />
        <DetailItem
          label="Supplier requested lead time"
          value={`${row.cover?.leadDays ?? requested} days`}
          source="Supplier feed"
        />
        <DetailItem
          label="Cause"
          value={CAUSE_LABEL[causeOf(row.signal)]}
          source="Classified from the supplier feed"
        />
      </DetailSection>

      <DetailSection title="Who answers">
        <DetailItem label="Contact" value={contact.name} source="Supplier master" />
        <DetailItem label="Role" value={contact.role} source="Supplier master" />
        <DetailItem
          label="Phone"
          value={contact.phone}
          source="Supplier master"
          action={
            <Button
              variant="ghost"
              size="sm"
              aria-label="Copy phone number"
              onClick={() => void navigator.clipboard?.writeText(contact.phone)}
            >
              <Copy size={13} />
            </Button>
          }
        />
        <DetailItem label="Email" value={contact.email} source="Supplier master" />
        <DetailItem label="Working hours" value={contact.hours} source="Supplier master" />
        <DetailItem
          label="Responsiveness"
          value={contact.respondsIn}
          source="Databricks · response history"
        />
      </DetailSection>
    </DetailCard>
  );
}
