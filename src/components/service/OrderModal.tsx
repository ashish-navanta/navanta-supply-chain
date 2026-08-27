"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClipboardText,
  MapPinLine,
  Package,
  Receipt,
  Storefront,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button, PanelTimeline, Pill, Tabs } from "@navanta-ai/design-system";
import { Modal, type ModalProps } from "@/components/ui/Modal";
import { AgentSummary } from "@/components/chat/AgentSummary";
import { DetailCard, DetailItem, DetailSection } from "@/components/chat/DetailGrid";
import { contactFor } from "@/data/action-center";
import {
  CLAIMS,
  CLAIM_KIND_LABEL,
  CLAIM_STAGE_LABEL,
  HEALTH_LABEL,
  STAGE_LABEL,
  bestEta,
  dealerByName,
  formatUsd,
  hasEtaConflict,
  type ServiceOrder,
} from "@/data/service";
import { SERVICE_ROUTES } from "@/data/nav";
import { EtaReconciler } from "@/components/service/EtaReconciler";

/**
 * One order, read the way the buyer reads a purchase order: Christy's line on
 * it and the figures the call turns on, then the record in tabs — where it
 * actually is, what is on it, who receives it, and what has been claimed
 * against it.
 *
 * The action band is a claim, not a commitment. Nothing on an order is Daniela's
 * to decide; what she does with a damaged or short delivery is file, and that is
 * the one button here.
 */
export function OrderModal({
  order,
  agent,
  nav,
  onClose,
  onFileClaim,
}: {
  order: ServiceOrder;
  agent: string;
  nav?: ModalProps["nav"];
  onClose: () => void;
  /** Opens the claim wizard pre-filled with this order. */
  onFileClaim: (order: ServiceOrder) => void;
}) {
  type Panel = "tracking" | "lines" | "account" | "claims";
  const [panel, setPanel] = useState<Panel>("tracking");

  const eta = bestEta(order);
  const conflict = hasEtaConflict(order);
  const account = dealerByName(order.account);
  const contact = contactFor(order.account, false);
  const claims = CLAIMS.filter((c) => c.orderId === order.id);
  const slipped = order.currentEta !== order.promisedOn;

  return (
    <Modal
      title={`${order.id} — order record`}
      size="xxwide"
      fixedHeight={760}
      nav={nav}
      onClose={onClose}
      headerContent={
        <div className="flex items-center" style={{ gap: 10 }}>
          <Package size={18} weight="duotone" style={{ color: "var(--text-primary)" }} />
          <span className="type-title" style={{ color: "var(--ds-text-primary)" }}>
            {order.id}
          </span>
          <Pill variant="info" size="sm">
            {order.account}
          </Pill>
          <Pill
            variant={
              order.health === "on-track" || order.health === "delivered-clean"
                ? "neutral"
                : order.health === "delayed" || order.health === "backordered"
                  ? "danger"
                  : "warning"
            }
            size="sm"
          >
            {HEALTH_LABEL[order.health]}
          </Pill>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <AgentSummary
          agent={agent}
          text={order.note}
          facts={[
            { label: "Order value", value: formatUsd(order.value) },
            { label: "Quantity", value: `${order.units} units` },
            {
              label: "Promised",
              value: order.promisedOn,
              /* The re-promise shown as `promised → now`, the same mechanic the
                 buyer's lead-time decision uses — but captioned "re-promised",
                 because this already happened rather than waiting on a confirm. */
              next: slipped ? order.currentEta : undefined,
              nextLabel: "re-promised",
            },
            {
              label: order.stage === "delivered" ? "Delivered" : "Best ETA",
              value: order.stage === "delivered" ? (order.deliveredOn ?? "—") : eta.date,
            },
            {
              label: "Install date",
              value: order.installOn
                ? `${order.installOn}${order.crewBooked ? " · crew booked" : ""}`
                : "None given",
            },
          ]}
        >
          {/* Filing is the only action an order carries, and only once there is
              a receipt to file against. */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 p-3"
            style={{ background: "var(--gradient-agent-band)" }}
          >
            <span className="flex min-w-0 flex-col">
              <span className="ds-label" style={{ color: "var(--color-iris-700)" }}>
                {order.receipt ? "Delivered and receipted" : "Not yet delivered"}
              </span>
              <span className="ds-body-medium" style={{ color: "var(--ds-text-primary)" }}>
                {order.receipt
                  ? `${order.receipt}${order.shortPallets ? ` · ${order.shortPallets} units short or damaged` : " · signed complete"}`
                  : `A claim can be filed once ${order.account} has receipted the delivery`}
              </span>
            </span>
            <Button
              variant="christy"
              size="sm"
              iconLeft={<ClipboardText size={14} />}
              disabled={!order.receipt}
              onClick={() => onFileClaim(order)}
            >
              File a claim
            </Button>
          </div>
        </AgentSummary>

        <Tabs
          variant="underline"
          className="border-b border-[color:var(--ds-border-subtle)]"
          tabs={[
            { id: "tracking", label: "Tracking", icon: MapPinLine },
            { id: "lines", label: "Line items", icon: Receipt, badge: order.lines.length },
            { id: "account", label: "Account", icon: Storefront },
            { id: "claims", label: "Claims", icon: ClipboardText, badge: claims.length },
          ]}
          activeTab={panel}
          onChange={(id) => setPanel(id as Panel)}
        />

        {panel === "tracking" ? (
          <div className="flex flex-col gap-4">
            {conflict && <EtaReconciler order={order} agent={agent} />}
            <div
              className="rounded-xl px-5 py-4"
              style={{ border: "1px solid var(--ds-border-default)" }}
            >
              {/* The DS timeline takes exactly the shape the order milestones are
                  authored in, so the stepper needs no adapter. */}
              <PanelTimeline
                title={`${STAGE_LABEL[order.stage]} — ${order.lane}`}
                milestones={order.milestones}
                idPrefix={order.id}
              />
            </div>
          </div>
        ) : panel === "lines" ? (
          <DetailCard>
            <DetailSection title="What is on the order" columns={1}>
              <ul className="flex flex-col">
                {order.lines.map((l, i) => (
                  <li
                    key={l.sku}
                    className="flex items-center gap-3 py-2.5"
                    style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="ds-body-medium truncate" style={{ color: "var(--ds-text-primary)" }}>
                        {l.style}
                      </span>
                      <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                        {`SKU ${l.sku} · batch ${l.dyeLot}`}
                      </span>
                    </span>
                    <span
                      className="ds-body-medium shrink-0"
                      style={{ color: "var(--ds-text-primary)", fontVariantNumeric: "tabular-nums" }}
                    >
                      {`${l.units} units`}
                    </span>
                    <span
                      className="ds-body-medium shrink-0 text-right"
                      style={{ width: 88, color: "var(--ds-text-primary)", fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatUsd(l.units * l.unitValue)}
                    </span>
                  </li>
                ))}
              </ul>
            </DetailSection>

            <DetailSection title="The shipment">
              <DetailItem label="Carrier" value={order.carrier} source="SAP WM" />
              <DetailItem label="Lane" value={order.lane} source="SAP WM" />
              <DetailItem
                label="Pro number"
                value={order.proNumber ?? "Not yet tendered"}
                source={order.proNumber ? "Carrier tender" : "Awaiting tender"}
              />
              <DetailItem
                label="Goods receipt"
                value={order.receipt ?? "Not delivered"}
                source={order.receipt ? "SAP WM · receiving" : "—"}
              />
            </DetailSection>
          </DetailCard>
        ) : panel === "account" ? (
          <DetailCard>
            <DetailSection title="The account">
              <DetailItem
                label="Account"
                value={order.account}
                source="SAP ECC · customer master"
                onSelect={() => undefined}
              />
              <DetailItem
                label="Location"
                value={account ? `${account.city}, ${account.state}` : "—"}
                source="Customer master"
              />
              <DetailItem label="Segment" value={account?.segment ?? "—"} source="Customer master" />
              <DetailItem label="Tier" value={account?.tier ?? "—"} source="Loyalty program" />
              <DetailItem
                label="On time in full"
                value={account ? `${account.onTimePct}%` : "—"}
                source="Databricks · 12-month delivery history"
              />
              <DetailItem
                label="Claim rate"
                value={account ? `${account.claimRate} per 100 orders` : "—"}
                source="Databricks · claim history"
              />
              <DetailItem label="Terms" value={account?.paymentTerms ?? "—"} source="SAP ECC · AR" />
              <DetailItem label="Since" value={account?.since ?? "—"} source="Customer master" />
            </DetailSection>

            <DetailSection title="Who answers">
              <DetailItem label="Contact" value={contact.name} source="Customer master" />
              <DetailItem label="Role" value={contact.role} source="Customer master" />
              <DetailItem label="Phone" value={contact.phone} source="Customer master" />
              <DetailItem label="Email" value={contact.email} source="Customer master" />
              <DetailItem label="Hours" value={contact.hours} source="Customer master" />
              <DetailItem
                label="Responsiveness"
                value={contact.respondsIn}
                source="Databricks · response history"
              />
            </DetailSection>
          </DetailCard>
        ) : (
          <DetailCard>
            <DetailSection title="Claimed against this order" columns={1}>
              {claims.length === 0 ? (
                <span className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
                  {order.receipt
                    ? "Nothing claimed. The delivery was receipted clean."
                    : "Nothing claimed — the order has not been delivered yet."}
                </span>
              ) : (
                <ul className="flex flex-col">
                  {claims.map((c, i) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 py-2.5"
                      style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                    >
                      {c.stage === "credit-ready" && (
                        <WarningCircle
                          size={15}
                          weight="duotone"
                          className="shrink-0"
                          style={{ color: "var(--text-warning)" }}
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Link
                          href={`${SERVICE_ROUTES.claims}?claim=${c.id}`}
                          className="ds-body-medium truncate hover:underline"
                          style={{ color: "var(--color-iris-700)" }}
                        >
                          {`${c.id} — ${CLAIM_KIND_LABEL[c.kind]}`}
                        </Link>
                        <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                          {`${c.units} units · asked ${formatUsd(c.requested)} · batch ${c.batch}`}
                        </span>
                      </span>
                      <Pill variant={c.stage === "settled" ? "info" : "neutral"} size="sm">
                        {CLAIM_STAGE_LABEL[c.stage]}
                      </Pill>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
          </DetailCard>
        )}
      </div>
    </Modal>
  );
}
