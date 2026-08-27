import { Suspense } from "react";
import { OrdersScreen } from "@/components/service/OrdersScreen";

export const metadata = {
  title: "Service · Orders",
};

export default function ServiceOrdersPage() {
  /* `useSearchParams` — the ?order= / ?claim= deep links between the service
     pages — needs a Suspense boundary to keep the route prerenderable. */
  return (
    <Suspense fallback={null}>
      <OrdersScreen />
    </Suspense>
  );
}
