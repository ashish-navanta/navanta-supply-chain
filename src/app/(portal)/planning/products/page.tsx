import { ProductCatalogueScreen } from "@/components/planning/ProductCatalogueScreen";

/* The route stays under /planning — every productRoute() link in the app
   points here — but the page belongs to the service seat now. */
export const metadata = { title: "Service · Product catalogue" };

export default function ProductCataloguePage() {
  return <ProductCatalogueScreen />;
}
