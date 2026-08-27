import { notFound } from "next/navigation";
import { ORDERS, orderById } from "@/data/service";
import { OrderDetailPage } from "@/components/service/OrderDetailPage";

export function generateStaticParams() {
  return ORDERS.map((o) => ({ id: o.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Service · ${id}` };
}

export default async function ServiceOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = orderById(id);
  if (!order) notFound();
  return <OrderDetailPage id={order.id} />;
}
