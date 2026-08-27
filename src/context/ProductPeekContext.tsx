"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ProductPeek } from "@/components/planning/ProductPeek";

/* ═══════════════════════════════════════════════════════════════
 *  Peeking at a product
 *
 *  A SKU is printed on nearly every table in this app, and most of
 *  the time somebody clicking one is checking a fact — what colour is
 *  that, how much is on hand, who makes it — not settling in to read a
 *  record. Sending them to a full page for that costs them the row
 *  they were working and a trip back.
 *
 *  So the first view is a panel over the page they are on, and the
 *  panel offers the full page for when the answer is not enough. The
 *  same rule the rest of the app already follows for a queue line: the
 *  glance is cheap, the record is a click away, and neither pretends
 *  to be the other.
 *
 *  Held here rather than per screen so there is one panel in the
 *  document. Six tables each owning their own would be six panels that
 *  can disagree about what is open.
 * ═══════════════════════════════════════════════════════════════ */

interface ProductPeekValue {
  /** Open the panel on a SKU. */
  peek: (sku: string) => void;
  close: () => void;
  /** The SKU on show, or null. */
  sku: string | null;
}

const Ctx = createContext<ProductPeekValue | undefined>(undefined);

export function ProductPeekProvider({ children }: { children: ReactNode }) {
  const [sku, setSku] = useState<string | null>(null);
  return (
    <Ctx.Provider value={{ sku, peek: setSku, close: () => setSku(null) }}>
      {children}
      <ProductPeek sku={sku} onClose={() => setSku(null)} />
    </Ctx.Provider>
  );
}

export function useProductPeek(): ProductPeekValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProductPeek must be used inside a ProductPeekProvider");
  return ctx;
}
