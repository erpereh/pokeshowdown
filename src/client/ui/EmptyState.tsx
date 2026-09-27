import type { ReactNode } from "react";
import { GlassPanel } from "./GlassPanel.tsx";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <GlassPanel className="mx-auto flex max-w-lg flex-col items-start gap-3 px-6 py-8">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="text-text-dim">{body}</p>
      {action}
    </GlassPanel>
  );
}
