import type { CompanyBrand } from "@/types/company";

/**
 * Navanta's own chrome, for the retail (Target-pitch) pack: the real mark in
 * the top bar, a white cut on a rail painted in the brand's blue→purple ramp,
 * and the Customer Ops page gradient beneath the work.
 */
export const BRAND: CompanyBrand = {
  id: "target",
  company: "Target",
  product: "Navanta",
  industry: "Mass-market retail",
  appTitle: "Navanta · Supply Chain",
  description:
    "The seats in a retail supply chain — buyer, planner, service rep and logistics coordinator — run on Navanta.",
  logo: "/companies/target/navanta-logo.svg",
  logoWhite: "/companies/target/navanta-logo-white.svg",
  mark: "/companies/target/navanta-mark.svg",
  logoHeight: 18,
  navBrand: "#1d4a86",
  railGradient: "linear-gradient(180deg, #1d4a86 0%, #3d348b 100%)",
  pageGradient: "linear-gradient(130deg, #D9E2F9 28.38%, #C1CFF3 74.14%)",
  scope: { placeLabel: "State", allPlaces: "All states" },
  itemCodeLabel: "DPCI",
  constructionLabels: { import: "Import", domestic: "Domestic" },
  constructionLabel: "Sourcing lane",
};
