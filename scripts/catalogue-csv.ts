/**
 * Writes the catalogue to `public/product-catalogue.csv`.
 *
 * The same bytes the download button produces — one generator, so the file on
 * disk and the file a user downloads cannot describe different books. Run it
 * after changing the catalogue: `npm run catalogue:csv`.
 */
import { writeFileSync } from "node:fs";
import { catalogueCsv } from "@/data/catalogue-csv";

const path = "public/product-catalogue.csv";
writeFileSync(path, catalogueCsv(), "utf8");
console.log(`wrote ${path}`);
