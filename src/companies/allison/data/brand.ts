import type { CompanyBrand } from "@/types/company";

/**
 * Allison Transmission's chrome — the brand blue from the wordmark on the rail,
 * a cool neutral ground beneath the work. The red of the mark stays in the logo
 * alone: a second saturated hue on the rail would fight the iris agent panel.
 *
 * The book is Allison's own finished product — transmissions and electric
 * axles — so the labels below name a UNIT and its route to a customer, not a
 * spare and its supplier.
 */
export const BRAND: CompanyBrand = {
  id: "allison",
  company: "Allison Transmission",
  product: "Navanta",
  industry: "Commercial vehicle driveline · automatic transmissions",
  appTitle: "Allison · Supply Chain",
  description:
    "The seats behind Allison Transmission's finished-goods book — component buyer, build planner, OEM and channel service desk, and outbound logistics — run on Navanta.",
  logo: "/companies/allison/allison-transmission-full.svg",
  logoWhite: "/companies/allison/allison-transmission-full.svg",
  mark: "/companies/allison/allison-transmission-small.svg",
  logoHeight: 16,
  navBrand: "#1c4d8a",
  railGradient: "linear-gradient(180deg, #2360A5 0%, #163d6b 100%)",
  pageGradient: "linear-gradient(130deg, #E6EDF7 0%, #D3DDEC 100%)",
  scope: { placeLabel: "Country", allPlaces: "All countries" },
  itemCodeLabel: "Material #",
  constructionLabels: { program: "OEM programme", channel: "Distributor channel" },
  constructionLabel: "Route to customer",
};
