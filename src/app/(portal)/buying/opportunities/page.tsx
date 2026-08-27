import { Suspense } from "react";
import { OpportunitiesScreen } from "@/components/buying/OpportunitiesScreen";

export const metadata = {
  title: "Buying · Opportunities",
};

export default function OpportunitiesPage() {
  /* `useSearchParams` (the ?play= deep link from the command center) needs a
     Suspense boundary to keep the route statically prerenderable. */
  return (
    <Suspense fallback={null}>
      <OpportunitiesScreen />
    </Suspense>
  );
}
