import { Suspense } from "react";
import { ClaimsScreen } from "@/components/service/ClaimsScreen";

export const metadata = {
  title: "Service · Claims",
};

export default function ServiceClaimsPage() {
  /* `useSearchParams` — the ?order= / ?claim= deep links between the service
     pages — needs a Suspense boundary to keep the route prerenderable. */
  return (
    <Suspense fallback={null}>
      <ClaimsScreen />
    </Suspense>
  );
}
