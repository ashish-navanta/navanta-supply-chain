import type { CompanyBrand } from "@/types/company";

/**
 * Fossil's chrome — a warm near-black rail drawn from the black wordmark over
 * the brand's leather tones, and a faintly warm page ground. Black is the one
 * accent that sits beside the iris agent panel without a fight.
 */
export const BRAND: CompanyBrand = {
  id: "fossil",
  company: "Fossil Group",
  product: "Navanta",
  industry: "Watches & accessories",
  appTitle: "Fossil · Supply Chain Personas",
  description:
    "The four seats in Fossil's supply chain — buyer, planner, service rep and logistics coordinator.",
  logo: "/companies/fossil/fossil-logo.svg",
  logoWhite: "/companies/fossil/fossil-logo-white.svg",
  mark: "/companies/fossil/fossil-mark.svg",
  logoHeight: 18,
  navBrand: "#2a211c",
  railGradient: "none",
  pageGradient:
    "linear-gradient(183deg, rgba(25, 0, 0, 0.12) 3.06%, rgba(25, 0, 0, 0.08) 97.34%), #FFF",
  scope: { placeLabel: "Country", allPlaces: "All countries" },
  itemCodeLabel: null,
  constructionLabels: { bracelet: "Bracelet", strap: "Strap" },
  constructionLabel: "Construction type",
};
