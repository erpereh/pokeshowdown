import type { ReactNode } from "react";
import { GlassPanel } from "./GlassPanel.tsx";
import { Icon } from "./Icon.tsx";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <GlassPanel className="mx-auto flex w-full max-w-lg flex-col items-start gap-4 px-6 py-8">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-line-strong bg-accent-2/10 text-accent-2"><Icon name="spark" /></span>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="text-sm leading-relaxed text-text-dim">{body}</p>
      {action}
    </GlassPanel>
  );
}
