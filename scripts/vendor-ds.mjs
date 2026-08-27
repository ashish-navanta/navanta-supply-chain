/**
 * Re-vendor @navanta-ai/design-system from the local IRIS checkout.
 *
 * The design system lives on GitHub Packages and needs a valid
 * `//npm.pkg.github.com/:_authToken` in .npmrc. The token copied over from
 * IRIS is expired (npm returns 401), so `npm install` cannot fetch it and
 * will DELETE the package from node_modules on every run.
 *
 * Until the token is refreshed, run this after any `npm install`:
 *     npm run ds:vendor
 *
 * Once .npmrc holds a working token this script is unnecessary — the
 * `^0.4.27` entry in package.json resolves normally.
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const SOURCE = resolve(root, "../Navanta/iris/node_modules/@navanta-ai/design-system");
const TARGET = resolve(root, "node_modules/@navanta-ai/design-system");

if (!existsSync(SOURCE)) {
  console.error(`✗ Source not found: ${SOURCE}`);
  console.error("  Install the design system in the IRIS project first, or refresh the");
  console.error("  GitHub Packages token in .npmrc and run `npm install` here instead.");
  process.exit(1);
}

mkdirSync(dirname(TARGET), { recursive: true });
cpSync(SOURCE, TARGET, { recursive: true });

const { version } = JSON.parse(readFileSync(resolve(TARGET, "package.json"), "utf8"));
console.log(`✓ Vendored @navanta-ai/design-system@${version} from the IRIS checkout`);
