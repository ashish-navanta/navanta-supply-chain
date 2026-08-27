import { Suspense } from "react";
import { SuppliersScreen } from "@/components/buying/SuppliersScreen";

export const metadata = {
  title: "Buying · Suppliers",
};

export default function SuppliersPage() {
  /* `useSearchParams` (the ?supplier= deep link from the Mercer chat outcome)
     needs a Suspense boundary to keep the route statically prerenderable. */
  return (
    <Suspense fallback={null}>
      <SuppliersScreen />
    </Suspense>
  );
}
