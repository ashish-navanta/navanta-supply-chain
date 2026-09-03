import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BRAND } from "@/data/brand";
import { companyById } from "@/companies/registry";

const run = promisify(execFile);

/** Which pack the running build is wearing. */
export async function GET() {
  return NextResponse.json({ active: BRAND.id });
}

/**
 * Switch the pack — DEVELOPMENT ONLY.
 *
 * In dev the facades in src/data are regenerated and Next picks the change up
 * on its own, so the launcher can hand you a different company without a
 * restart. A production build is one company by construction (the pack is
 * resolved at build time), so here the route refuses and the launcher links to
 * that company's own deployment instead.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Company is fixed at build time in production." }, { status: 400 });
  }
  const { id } = (await req.json()) as { id?: string };
  if (!id || !companyById(id)) {
    return NextResponse.json({ error: "Unknown company." }, { status: 400 });
  }
  await run(process.execPath, ["scripts/select-company.mjs", id], { cwd: process.cwd() });
  return NextResponse.json({ active: id });
}
