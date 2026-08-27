import { notFound } from "next/navigation";
import { CLAIMS, claimById } from "@/data/service";
import { ClaimDetailScreen } from "@/components/service/ClaimDetailScreen";

export function generateStaticParams() {
  return CLAIMS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Service · ${decodeURIComponent(id)}` };
}

export default async function ServiceClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  /* Resolved on the server so a bad reference 404s rather than rendering an
     empty page — the same shape as the order route beside it. */
  const claim = claimById(decodeURIComponent(id));
  if (!claim) notFound();
  return <ClaimDetailScreen claim={claim} />;
}
