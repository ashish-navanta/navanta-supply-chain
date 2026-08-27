"use client";

import { useState } from "react";
import Link from "next/link";
import { Buildings, ClipboardText, Copy, Package, Storefront } from "@phosphor-icons/react";
import { Button, Pill, Tabs } from "@navanta-ai/design-system";
import { Modal, type ModalProps } from "@/components/ui/Modal";
import { AgentSummary } from "@/components/chat/AgentSummary";
import { DetailCard, DetailItem, DetailSection } from "@/components/chat/DetailGrid";
import { contactFor } from "@/data/action-center";
import {
  AT_RISK,
  CLAIM_KIND_LABEL,
  CLAIM_STAGE_LABEL,
  HEALTH_LABEL,
  dealerBook,
  formatUsd,
  type Account,
} from "@/data/service";
import { SERVICE_ROUTES, orderRoute } from "@/data/nav";

/**
 * One account account: what we sell them, how we serve them, and everything open
 * on both sides of the desk.
 *
 * No action band — a account is not a decision. The decisions that touch one live
 * on an order or a claim, and both are linked from here rather than restated.
 */
export function AccountModal({
  account,
  agent,
  nav,
  onClose,
}: {
  account: Account;
  agent: string;
  nav?: ModalProps["nav"];
  onClose: () => void;
}) {
  type Panel = "account" | "orders" | "claims";
  const [panel, setPanel] = useState<Panel>("account");

  const book = dealerBook(account.name);
  const contact = contactFor(account.name, false);
  const openOrders = book.orders.filter((o) => o.stage !== "delivered");
  /* A account's claims clustering on one lot is a factory conversation, not a
     account one — and it is the single most useful thing to know before reading
     the claim rate as a judgement on them. */
  const lots = [...new Set(book.claims.map((c) => c.batch))];
  const worstLot = lots
    .map((b) => ({ batch: b, n: book.claims.filter((c) => c.batch === b).length }))
    .sort((a, b) => b.n - a.n)[0];

  return (
    <Modal
      title={`${account.name} — account record`}
      size="xxwide"
      fixedHeight={760}
      nav={nav}
      onClose={onClose}
      headerContent={
        <div className="flex items-center" style={{ gap: 10 }}>
          <Storefront size={18} weight="duotone" style={{ color: "var(--text-primary)" }} />
          <span className="type-title" style={{ color: "var(--ds-text-primary)" }}>
            {account.name}
          </span>
          <Pill variant="info" size="sm">{`${account.city}, ${account.state}`}</Pill>
          <Pill variant="neutral" size="sm">{`${account.segment} · ${account.tier}`}</Pill>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <AgentSummary
          agent={agent}
          text={
            `${account.note} ${formatUsd(account.ytdRevenue)} year to date at ${account.onTimePct}% on time, ` +
            `${account.claimRate} claims per hundred orders. ` +
            `${openOrders.length} ${openOrders.length === 1 ? "order is" : "orders are"} open for ${formatUsd(book.openValue)}` +
            `${book.atRisk > 0 ? `, ${book.atRisk} of them at risk` : ""}` +
            `${
              worstLot && worstLot.n > 1
                ? `, and ${worstLot.n} of their claims trace to batch ${worstLot.batch} rather than to anything they did.`
                : "."
            }`
          }
          facts={[
            { label: "Revenue YTD", value: formatUsd(account.ytdRevenue) },
            { label: "Open with us", value: formatUsd(book.openValue) },
            { label: "On time in full", value: `${account.onTimePct}%` },
            { label: "Claim rate", value: `${account.claimRate} / 100` },
            { label: "Terms", value: account.paymentTerms },
          ]}
        />

        <Tabs
          variant="underline"
          className="border-b border-[color:var(--ds-border-subtle)]"
          tabs={[
            { id: "account", label: "The account", icon: Buildings },
            { id: "orders", label: "Orders", icon: Package, badge: book.orders.length },
            { id: "claims", label: "Claims", icon: ClipboardText, badge: book.claims.length },
          ]}
          activeTab={panel}
          onChange={(id) => setPanel(id as Panel)}
        />

        {panel === "account" ? (
          <DetailCard>
            <DetailSection title="The account">
              <DetailItem label="Segment" value={account.segment} source="Customer master" />
              <DetailItem label="Loyalty tier" value={account.tier} source="Loyalty program" />
              <DetailItem label="Customer since" value={account.since} source="Customer master" />
              <DetailItem label="Payment terms" value={account.paymentTerms} source="SAP ECC · AR" />
              <DetailItem
                label="Revenue year to date"
                value={formatUsd(account.ytdRevenue)}
                source="SAP ECC · sales"
              />
              <DetailItem
                label="Orders all time"
                value={String(book.orders.length)}
                source="SAP ECC · order history"
              />
              <DetailItem
                label="On time in full"
                value={`${account.onTimePct}%`}
                source="Databricks · 12-month delivery history"
              />
              <DetailItem
                label="Claim rate"
                value={`${account.claimRate} per 100 orders`}
                source="Databricks · claim history"
              />
            </DetailSection>

            <DetailSection title="Who answers">
              <DetailItem label="Contact" value={contact.name} source="Customer master" />
              <DetailItem label="Role" value={contact.role} source="Customer master" />
              <DetailItem
                label="Phone"
                value={contact.phone}
                source="Customer master"
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
              <DetailItem label="Email" value={contact.email} source="Customer master" />
              <DetailItem label="Working hours" value={contact.hours} source="Customer master" />
              <DetailItem
                label="Preferred channel"
                value={contact.prefers === "call" ? "Phone — rarely answers email" : "Email — replies same day"}
                source="Databricks · response history"
              />
            </DetailSection>
          </DetailCard>
        ) : panel === "orders" ? (
          <DetailCard>
            <DetailSection title="Their orders" columns={1}>
              <ul className="flex flex-col">
                {book.orders.map((o, i) => (
                  <li
                    key={o.id}
                    className="flex items-center gap-3 py-2.5"
                    style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={orderRoute(o.id)}
                        className="ds-body-medium truncate hover:underline"
                        style={{ color: "var(--color-iris-700)" }}
                      >
                        {`${o.id} — ${o.style}`}
                      </Link>
                      <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                        {`${o.units} units · ${formatUsd(o.value)} · promised ${o.promisedOn}${
                          o.currentEta !== o.promisedOn ? ` → ${o.currentEta}` : ""
                        }`}
                      </span>
                    </span>
                    <Pill
                      variant={
                        AT_RISK.has(o.health)
                          ? o.health === "at-risk"
                            ? "warning"
                            : "danger"
                          : o.health === "delivered-short"
                            ? "warning"
                            : "neutral"
                      }
                      size="sm"
                    >
                      {HEALTH_LABEL[o.health]}
                    </Pill>
                  </li>
                ))}
              </ul>
            </DetailSection>
          </DetailCard>
        ) : (
          <DetailCard>
            <DetailSection title="Their claims" columns={1}>
              {book.claims.length === 0 ? (
                <span className="ds-body" style={{ color: "var(--ds-text-secondary)" }}>
                  {`${account.name} has never raised a claim.`}
                </span>
              ) : (
                <ul className="flex flex-col">
                  {book.claims.map((c, i) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 py-2.5"
                      style={{ borderTop: i === 0 ? undefined : "1px solid var(--ds-border-subtle)" }}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Link
                          href={`${SERVICE_ROUTES.claims}?claim=${c.id}`}
                          className="ds-body-medium truncate hover:underline"
                          style={{ color: "var(--color-iris-700)" }}
                        >
                          {`${c.id} — ${CLAIM_KIND_LABEL[c.kind]}`}
                        </Link>
                        <span className="ds-label truncate" style={{ color: "var(--ds-text-secondary)" }}>
                          {`${c.units} units · asked ${formatUsd(c.requested)}${
                            c.adjudicated !== null && c.adjudicated !== c.requested
                              ? ` · ${formatUsd(c.adjudicated)} adjudicated`
                              : ""
                          } · batch ${c.batch}`}
                        </span>
                      </span>
                      <Pill
                        variant={
                          c.stage === "credit-ready"
                            ? "warning"
                            : c.stage === "declined"
                              ? "danger"
                              : c.stage === "settled" || c.stage === "approved"
                                ? "info"
                                : "neutral"
                        }
                        size="sm"
                      >
                        {CLAIM_STAGE_LABEL[c.stage]}
                      </Pill>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>

            {worstLot && worstLot.n > 1 && (
              <DetailSection title={`${agent} reads this as a lot problem`} columns={1}>
                <span className="ds-body" style={{ color: "var(--ds-text-primary)" }}>
                  {`${worstLot.n} of ${account.name}'s ${book.claims.length} claims are against batch ${worstLot.batch}. ` +
                    `Their claim rate of ${account.claimRate} per hundred reads badly until you notice that — the account is not the problem, the lot is.`}
                </span>
              </DetailSection>
            )}
          </DetailCard>
        )}
      </div>
    </Modal>
  );
}
