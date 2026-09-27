"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./cx.ts";

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

  return (
    <div data-modal-root className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="glass relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[var(--radius-panel)] p-5 shadow-[0_24px_80px_#000000aa]"
      >
        <h2 id={titleId} className="font-display text-2xl font-bold">
          {title}
        </h2>
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

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          "glass relative z-10 flex max-h-[85dvh] w-full flex-col rounded-t-[var(--radius-panel)] shadow-[0_-20px_60px_#000000aa]",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <h2 id={titleId} className="font-display text-xl font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="font-display min-h-11 rounded-[var(--radius-card)] px-3 text-sm font-semibold uppercase text-text-dim">
            Cerrar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      </div>
    </div>
  );
}
