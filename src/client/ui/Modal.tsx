"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx.ts";
import { Icon } from "./Icon.tsx";

export function useDialog(open: boolean, onClose?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      [...(node?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? [])].filter(
        (element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0 && element.tabIndex >= 0,
      );

    (node?.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[0] ?? node)?.focus();

    function onKey(event: KeyboardEvent) {
      // Only the top dialog handles a key when an editor opens another modal.
      if ([...document.querySelectorAll("[role='dialog'][aria-modal='true']")].at(-1) !== node) return;
      if (event.key === "Escape") {
        if (!closeRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  return ref;
}

/** Dialogs render on <body> so transformed or clipped ancestors (animated cards) never trap them. */
function portal(node: ReactNode) {
  return typeof document === "undefined" ? node : createPortal(node, document.body);
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useDialog(open, onClose);
  const titleId = useId();
  if (!open) return null;

  return portal(
    <div data-modal-root className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center">
      <div className="animate-overlay-in absolute inset-0 bg-[#1b2230]/45" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-pop-in relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[var(--radius-panel)] bg-surface p-5 text-left text-text shadow-[0_24px_60px_-20px_#1b2230aa]"
      >
        <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="font-display text-xl font-semibold">
          {title}
        </h2>
        <button type="button" aria-label={`Cerrar ${title}`} onClick={onClose} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-dim hover:text-text"><Icon name="close" /></button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useDialog(open, onClose);
  const titleId = useId();
  if (!open) return null;

  return portal(
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="animate-overlay-in absolute inset-0 bg-[#1b2230]/45" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          "animate-sheet-up relative z-10 mx-auto flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-[32px] bg-surface text-left text-text shadow-[0_-20px_60px_-20px_#1b2230aa]",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <div aria-hidden="true" className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-line-strong" />
        <div className="flex items-center justify-between gap-3 px-5 pt-2">
          <h2 id={titleId} className="font-display text-xl font-bold">
            {title}
          </h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-dim hover:text-text">
            <Icon name="close" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
