"use client";

import Link from "next/link";
import { productRoute } from "@/data/nav";
import { useProductPeek } from "@/context/ProductPeekContext";

/**
 * A SKU, wherever one is printed as a link.
 *
 * Clicking it opens the peek panel rather than the page, because a person
 * clicking a SKU number is nearly always checking a fact mid-task — what colour
 * is that, how much is on hand, who makes it — and answering it with a full
 * navigation costs them the row they were working and a trip back. The panel
 * offers the page for when the answer is not enough.
 *
 * Still a real anchor, and that is the point of not using a button: the href is
 * the true destination, so cmd-click, middle-click, "open in new tab" and hover
 * preview all keep working, and a reader who wants the page can take it
 * directly. Only the plain click is intercepted — the one that would otherwise
 * have cost them their place.
 */
export function SkuLink({
  sku,
  className,
  style,
  children,
  title,
}: {
  sku: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  title?: string;
}) {
  const { peek } = useProductPeek();
  return (
    <Link
      href={productRoute(sku)}
      title={title ?? `Preview ${sku}`}
      className={className}
      style={style}
      onClick={(e) => {
        /* Leave every deliberate new-window gesture alone. A modifier held down
           means the reader has already said where they want this to open. */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        /* The panel mounts during this very click, and its dismiss-on-outside-
           click listener is attached before the event has finished bubbling to
           the document — so without this the click that opens the panel is also
           the click that closes it, and nothing appears to happen at all. */
        e.stopPropagation();
        peek(sku);
      }}
    >
      {children}
    </Link>
  );
}
