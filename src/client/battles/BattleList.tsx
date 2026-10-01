"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, apiFetch } from "@/client/api.ts";
import { MiniSprite } from "@/client/sprites/MiniSprite.tsx";
import { Pokeball } from "@/client/ui/Card.tsx";
import { GameLink } from "@/client/ui/GameButton.tsx";
import { EmptyState } from "@/client/ui/EmptyState.tsx";
import { ErrorState } from "@/client/ui/ErrorState.tsx";
import { PageHeader } from "@/client/ui/PageHeader.tsx";
import { Spinner } from "@/client/ui/GameButton.tsx";
import { formatName, formatWhen, resultBadge } from "@/client/ui/format.ts";
import type { BattleSummary, ListBattlesResponse } from "@/shared/contract";

export function BattleList({ status }: { status: "active" | "finished" }) {
  const [battles, setBattles] = useState<BattleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setBattles(null);
    apiFetch<ListBattlesResponse>(`/api/battles?status=${status}`)
      .then((response) => setBattles(response.battles))
      .catch((reason: unknown) => setError(reason instanceof ApiRequestError ? reason.message : "No se pudieron cargar las partidas."));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const title = status === "active" ? "Partidas" : "Historial";
  const subtitle = status === "active" ? "Combates que puedes retomar donde los dejaste." : "Combates terminados y sus repeticiones.";

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      {error ? <ErrorState title="No se pudo cargar" body={error} onRetry={load} /> : null}
      {!error && battles === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : null}
      {battles && battles.length === 0 ? (
        <EmptyState
          title={status === "active" ? "No tienes partidas en curso" : "Todavía no has terminado ningún combate"}
          body={status === "active" ? "Empieza uno nuevo contra la CPU o desafía a un amigo." : "Cuando termine un combate, aparecerá aquí."}
          action={<GameLink href="/play">Jugar contra la CPU</GameLink>}
        />
      ) : null}
      {battles && battles.length > 0 ? (
        <ul className="stagger flex flex-col gap-3">
          {battles.map((battle) => {
            const badge = resultBadge(battle.result, battle.endReason);
            return (
              <li key={battle.id} className="battle-list-row card rounded-[24px]">
                <div className="flex min-w-0 flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-bold">{formatName(battle.formatId)}</h2>
                  {status === "finished" ? <span className={`font-display rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.text}</span> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex size-16 items-center justify-center rounded-full bg-accent-2/10">{battle.playerLead ? <MiniSprite spriteId={battle.playerLead.spriteId} alt={battle.playerLead.species} size={56} /> : <Pokeball className="size-9" />}</span>
                  <span className="font-display rounded-full bg-text px-2 py-0.5 text-xs font-bold text-white">VS</span>
                  <span className="flex size-16 items-center justify-center rounded-full bg-accent/10">{battle.cpuLead ? <MiniSprite spriteId={battle.cpuLead.spriteId} alt={battle.cpuLead.species} size={56} /> : <Pokeball className="size-9" />}</span>
                </div>
                <p className="text-sm text-text-dim">
                  {battle.mode === "online" ? <span className="font-semibold text-text">Online vs {battle.opponentName} · </span> : null}
                  Turno {battle.turn} · {formatWhen(battle.updatedAt)}
                </p>
                </div>
                <GameLink href={status === "active" ? `/battle/${battle.id}` : `/replay/${battle.id}`} variant={status === "active" ? "primary" : "secondary"} className="w-full md:w-auto">
                  {status === "active" ? "Continuar" : "Ver repetición"}
                </GameLink>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
