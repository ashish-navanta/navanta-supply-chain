import { Suspense } from "react";
import { QueueScreen } from "@/components/queue/QueueScreen";

export const metadata = {
  title: "Planning · Navanta Supply Chain",
};

export default function PlanningPage() {
  /* `useSearchParams` — the ?review= deep link the PO number opens in a new
     tab — needs a Suspense boundary to keep the route prerenderable. */
  return (
    <Suspense fallback={null}>
      <QueueScreen />
    </Suspense>
  );
}
