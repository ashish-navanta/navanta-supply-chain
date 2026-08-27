"use client";

import { orderById } from "@/data/service";
import { useChatPanel } from "@/context/ChatPanelContext";
import { OrderDetailScreen } from "@/components/service/OrderDetailScreen";

/**
 * The client half of the order route.
 *
 * The route resolves the id on the server so a bad one 404s rather than
 * rendering an empty page; this exists only to reach the chat panel, because
 * filing a claim is a conversation with the agent and not a second page.
 */
export function OrderDetailPage({ id }: { id: string }) {
  const { startClaim } = useChatPanel();
  const order = orderById(id);
  if (!order) return null;
  return <OrderDetailScreen order={order} onFileClaim={startClaim} />;
}
