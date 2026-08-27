import { notFound } from "next/navigation";
import { SKUS, skuRecord } from "@/data/catalogue";
import { ProductDetailScreen } from "@/components/planning/ProductDetailScreen";

export function generateStaticParams() {
  return SKUS.map((s) => ({ sku: s.sku }));
}

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const rec = skuRecord(decodeURIComponent(sku));
  return { title: rec ? `Product · ${rec.sku}` : "Product" };
}

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const record = skuRecord(decodeURIComponent(sku));
  if (!record) notFound();
  return <ProductDetailScreen record={record} />;
}
