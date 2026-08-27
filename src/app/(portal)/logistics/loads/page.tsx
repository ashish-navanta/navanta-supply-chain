import { Suspense } from "react";
import { LoadsScreen } from "@/components/logistics/LoadsScreen";

export const metadata = {
  title: "Logistics · Loads",
};

export default function LogisticsLoadsPage() {
  /* `useSearchParams` — the ?load= deep link from the action center — needs a
     Suspense boundary to keep the route prerenderable. */
  return (
    <Suspense fallback={null}>
      <LoadsScreen />
    </Suspense>
  );
}
