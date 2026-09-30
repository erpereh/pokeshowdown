"use client";

import { GameButton } from "./GameButton.tsx";
import { Card } from "./Card.tsx";

export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <Card className="animate-shake mx-auto flex w-full max-w-lg flex-col items-start gap-4 border-danger/40 px-6 py-8" role="alert">
      <h2 className="font-display text-2xl font-bold text-danger">{title}</h2>
      <p className="text-sm leading-relaxed text-text-dim">{body}</p>
      {onRetry ? (
        <GameButton variant="secondary" onClick={onRetry}>
          Reintentar
        </GameButton>
      ) : null}
    </Card>
  );
}
