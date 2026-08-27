"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CaretLeft, CaretRight, X, type Icon } from "@phosphor-icons/react";
import { Button } from "@navanta-ai/design-system";

type ModalSize = "default" | "wide" | "xwide" | "xxwide";

const MODAL_WIDTHS: Record<ModalSize, number> = {
  default: 520,
  wide: 758,
  // Matches the IRIS Demand Deck modal's card width so the two read as one
  // family — this shell is ported from that project.
  xwide: 971,
  // The Figma decision-modal frame — wide enough for four option cards and
  // the products table to breathe.
  xxwide: 1171,
};

export interface ModalProps {
  /** Modal title text. */
  title: string;
  /** Subtitle shown below the title in the header. */
  subtitle?: string;
  /** Phosphor icon rendered in the header (duotone, 18px). */
  icon?: Icon;
  /** Icon colour (default --text-primary). */
  iconColor?: string;
  /** Custom header content — replaces the default icon/title/subtitle block
   *  (the close button and header chrome stay). `title` is still required for
   *  the dialog's aria-label. */
  headerContent?: ReactNode;
  size?: ModalSize;
  /** Pin the dialog to this height (px) instead of letting it size to content,
   *  so a tabbed body doesn't resize the whole modal as panels swap. Still
   *  capped by the viewport; the body scrolls when the content is taller. */
  fixedHeight?: number;
  /**
   * Step through a list without closing — the header gets prev/next arrows and a
   * position label. Omit for a standalone modal.
   */
  nav?: {
    /** e.g. "3 of 7". */
    position: string;
    /** Undefined at the ends, which disables the arrow. */
    onPrev?: () => void;
    onNext?: () => void;
  };
  /** Called when the backdrop or close button is clicked. */
  onClose: () => void;
  children: ReactNode;
  /** Footer content. House rule: a one-line context on the left, the buttons
   *  on the right — the shell lays them out with justify-between. */
  footer?: ReactNode;
}

export function Modal({
  title,
  subtitle,
  icon: HeaderIcon,
  iconColor = "var(--text-primary)",
  headerContent,
  size = "default",
  fixedHeight,
  nav,
  onClose,
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(15, 16, 35, 0.55)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="mx-4 my-6 flex flex-col overflow-hidden rounded-[16px] bg-[var(--surface-base)]"
        style={{
          width: "100%",
          maxWidth: MODAL_WIDTHS[size],
          height: fixedHeight ? `min(${fixedHeight}px, calc(100vh - 48px))` : undefined,
          maxHeight: "calc(100vh - 48px)",
          boxShadow: "var(--shadow-modal)",
          animation: "modal-fade-up 0.22s ease-out both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E4E5E7] px-[12px] py-[12px] md:px-6 md:py-4">
          {headerContent ?? (
            <div className="flex items-start gap-2">
              {HeaderIcon && (
                <div className="shrink-0 py-[4px]">
                  <HeaderIcon size={18} weight="duotone" style={{ color: iconColor }} />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold leading-[1.44] text-[var(--text-primary)] md:text-[18px]">
                  {title}
                </span>
                {subtitle && (
                  <span className="text-[14px] text-[var(--text-secondary)]">{subtitle}</span>
                )}
              </div>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {nav && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!nav.onPrev}
                  onClick={nav.onPrev}
                  aria-label="Previous"
                >
                  <CaretLeft size={16} weight="bold" />
                </Button>
                <span
                  className="ds-label select-none px-0.5"
                  style={{ color: "var(--ds-text-secondary)" }}
                >
                  {nav.position}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!nav.onNext}
                  onClick={nav.onNext}
                  aria-label="Next"
                >
                  <CaretRight size={16} weight="bold" />
                </Button>
                <span
                  aria-hidden="true"
                  className="mx-1"
                  style={{ width: 1, height: 20, background: "var(--ds-border-subtle)" }}
                />
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} weight="bold" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-between border-t border-[#E4E5E7] bg-[var(--surface-sunken)] px-[12px] py-[12px] md:px-6 md:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
