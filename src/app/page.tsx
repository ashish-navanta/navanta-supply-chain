import { COMPANIES } from "@/companies/registry";
import { BRAND } from "@/data/brand";
import { LoginForm } from "@/components/launcher/LoginForm";

/**
 * The front door: sign in, choosing whose supply chain you are walking into.
 *
 * The portal is one UI worn by several companies. Every seat, queue, play and
 * agent conversation reads from a company pack, so the company chosen here
 * decides whose products, DCs, suppliers and brands appear on every screen
 * after it — the shell itself never changes. The active pack is the one this
 * build resolves its data imports to; in development the form can swap it live.
 */
export default function Home() {
  return (
    <main
      className="flex min-h-full flex-1 flex-col items-center justify-center"
      style={{ background: "linear-gradient(130deg, #D9E2F9 28.38%, #C1CFF3 74.14%)", padding: 32 }}
    >
      <div
        className="flex w-full flex-col"
        style={{
          maxWidth: 400,
          gap: 24,
          background: "#FFFFFF",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div className="flex flex-col" style={{ gap: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#0F172A", margin: 0 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>Choose the company whose portal you want to open.</p>
        </div>
        <LoginForm companies={COMPANIES} active={BRAND.id} dev={process.env.NODE_ENV !== "production"} />
      </div>
    </main>
  );
}
