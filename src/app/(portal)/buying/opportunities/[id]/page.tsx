import { notFound } from "next/navigation";
import { PLAYS } from "@/data/buying";
import { PlayDetailScreen } from "@/components/buying/PlayDetailScreen";

export function generateStaticParams() {
  return PLAYS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Buying · ${decodeURIComponent(id)}` };
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ref = decodeURIComponent(id);
  if (!PLAYS.some((p) => p.id === ref)) notFound();
  /* The screen reads the play from the store rather than taking it as a prop:
     accepting or committing changes its stage, and a prop resolved on the
     server would show the reader the version they arrived with. */
  return <PlayDetailScreen id={ref} />;
}
