import { notFound } from "next/navigation";
import { QUEUES } from "@/data/action-center";
import { PoDetailScreen } from "@/components/buying/PoDetailScreen";

/* Keyed on the reference rather than the row id. The URL is a thing people read
   and paste — /buying/action-center/PO-4463 says what it is, /…/b3 says nothing
   — and the breadcrumb's leaf is the last path segment, so the reference is
   what the trail reads too. */
export function generateStaticParams() {
  return QUEUES.buyer.rows.map((r) => ({ ref: r.ref }));
}

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return { title: `Buying · ${decodeURIComponent(ref)}` };
}

export default async function PoDetailPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const row = QUEUES.buyer.rows.find((r) => r.ref === decodeURIComponent(ref));
  if (!row) notFound();
  return <PoDetailScreen row={row} />;
}
