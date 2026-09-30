import type { ReactNode } from "react";
import { Card, Pokeball } from "./Card.tsx";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="animate-pop-in mx-auto flex w-full max-w-lg flex-col items-center gap-3 px-6 py-8 text-center">
      <Pokeball className="animate-float size-14" />
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="text-sm leading-relaxed text-text-dim">{body}</p>
      {action}
    </Card>
  );
}
