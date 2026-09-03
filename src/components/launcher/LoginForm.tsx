"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@navanta-ai/design-system";
import { ArrowRight, Buildings, CircleNotch, Eye, EyeSlash } from "@phosphor-icons/react";
import type { CompanyEntry } from "@/companies/registry";
import { DEMO_CREDENTIALS, clientReadSession, clientSetSession, credentialsValid } from "@/lib/session";

/**
 * The sign-in form, with the company as its third field.
 *
 * Signing in opens the portal in the chosen company's world. When that is the
 * company this build already wears, the door opens at once. Otherwise, in
 * development, the API regenerates the data facades and this waits for the
 * running build to answer with the new company before entering — a few seconds
 * while the dev server recompiles, and the button says so rather than looking
 * frozen. In production a build is one company, so the form sends you to that
 * company's own deployment.
 *
 * The check is the demo account in `lib/session.ts` — a fixed email and
 * password, verified in the browser. Enough to stop a stray click opening the
 * walkthrough; not authentication.
 */
export function LoginForm({
  companies,
  active,
  dev,
}: {
  companies: CompanyEntry[];
  active: string;
  dev: boolean;
}) {
  const router = useRouter();
  /* The demo account's email is pre-filled; the password is typed. */
  const [email, setEmail] = useState<string>(DEMO_CREDENTIALS.email);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [company, setCompany] = useState(active);
  const [busy, setBusy] = useState<"switching" | "entering" | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Remember who signed in last, so a returning demo does not retype. */
  useEffect(() => {
    const prior = clientReadSession();
    if (prior) {
      setEmail(prior.email);
      if (companies.some((c) => c.id === prior.company)) setCompany(prior.company);
    }
  }, [companies]);

  const chosen = companies.find((c) => c.id === company);
  const reachable = company === active || dev || Boolean(chosen?.url);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!chosen || busy) return;
    setError(null);
    if (!credentialsValid(email, password)) {
      setError("Incorrect email or password.");
      return;
    }
    clientSetSession({ email: email.trim(), company });

    if (company === active) {
      setBusy("entering");
      router.push("/executive");
      return;
    }
    if (!dev) {
      if (chosen.url) window.location.href = chosen.url;
      else setError("This company is not deployed yet.");
      return;
    }
    setBusy("switching");
    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: company }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Switch failed");
      /* Wait for the rebuilt facades to be live before entering. */
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 750));
        const now = await fetch("/api/company", { cache: "no-store" }).then((r) => r.json());
        if (now.active === company) {
          window.location.href = "/executive";
          return;
        }
      }
      throw new Error("The dev server did not pick up the new company in time — try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  const field: React.CSSProperties = {
    height: 40,
    width: "100%",
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    background: "#FFFFFF",
    padding: "0 12px",
    fontSize: 14,
    color: "#0F172A",
    outline: "none",
  };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "#64748B" };

  return (
    <form onSubmit={submit} className="flex flex-col" style={{ gap: 16 }} noValidate>
      <label className="flex flex-col" style={{ gap: 6 }}>
        <span style={label}>Work email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={field}
        />
      </label>

      <label className="flex flex-col" style={{ gap: 6 }}>
        <span style={label}>Password</span>
        <span className="relative flex items-center">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...field, paddingRight: 40 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inline-flex items-center justify-center"
            style={{ right: 8, width: 28, height: 28, borderRadius: 6, color: "#64748B" }}
          >
            {showPassword ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
          </button>
        </span>
      </label>

      <div className="flex flex-col" style={{ gap: 6 }}>
        <span style={label}>Company</span>
        <Select value={company} onValueChange={(v: string) => setCompany(v)}>
          <Select.Trigger aria-label="Company" className="w-full">
            <span className="min-w-0 items-center" style={{ display: "flex", gap: 8, whiteSpace: "nowrap" }}>
              <Buildings size={16} weight="duotone" className="shrink-0" style={{ color: "#64748B" }} />
              <Select.Value placeholder="Choose a company" />
            </span>
          </Select.Trigger>
          <Select.Content>
            {companies.map((c) => (
              <Select.Item key={c.id} value={c.id}>
                {c.company}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        {chosen && (
          <span style={{ fontSize: 12, color: "#64748B", lineHeight: "18px" }}>{chosen.industry}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={!reachable || busy !== null || !email.trim() || !password}
        className="inline-flex items-center justify-center font-medium transition-opacity disabled:opacity-50"
        style={{
          height: 40,
          gap: 8,
          borderRadius: 100,
          color: "#FFFFFF",
          fontSize: 14,
          background: "linear-gradient(119deg, #1D4A86 -1.66%, #3D348B 83.4%)",
          cursor: reachable && busy === null ? "pointer" : "default",
          marginTop: 4,
        }}
      >
        {busy === "switching" ? (
          <>
            <CircleNotch size={16} weight="bold" className="animate-spin" /> Opening {chosen?.company}…
          </>
        ) : busy === "entering" ? (
          <>
            <CircleNotch size={16} weight="bold" className="animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight size={16} weight="bold" />
          </>
        )}
      </button>

      {!reachable && chosen && (
        <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
          {chosen.company} is not deployed yet.
        </p>
      )}
      {error && (
        <p role="alert" style={{ fontSize: 13, color: "#DE1010", margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  );
}
