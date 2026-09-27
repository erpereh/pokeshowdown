"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, apiFetch } from "@/client/api.ts";
import { MiniSprite } from "@/client/sprites/MiniSprite.tsx";
import { GameLink } from "@/client/ui/GameButton.tsx";
import { EmptyState } from "@/client/ui/EmptyState.tsx";
import { ErrorState } from "@/client/ui/ErrorState.tsx";
import { PageHeader } from "@/client/ui/PageHeader.tsx";
import { Spinner } from "@/client/ui/GameButton.tsx";
import { formatName, formatWhen, resultBadge, toSpriteId } from "@/client/ui/format.ts";
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
      <PageHeader eyebrow="Un jugador" title={title} subtitle={subtitle} />
      {error ? <ErrorState title="No se pudo cargar" body={error} onRetry={load} /> : null}
      {!error && battles === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : null}
      {battles && battles.length === 0 ? (
        <EmptyState
          title={status === "active" ? "No tienes partidas en curso" : "Todavía no has terminado ningún combate"}
          body={status === "active" ? "Empieza uno nuevo contra la CPU." : "Cuando termine un combate, aparecerá aquí."}
          action={<GameLink href="/play">Jugar contra la CPU</GameLink>}
        />
      ) : null}
      {battles && battles.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {battles.map((battle) => {
            const badge = resultBadge(battle.result, battle.endReason);
            return (
              <li key={battle.id} className="glass flex flex-col gap-3 rounded-[var(--radius-card)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl font-bold">{formatName(battle.formatId)}</h2>
                  {status === "finished" ? <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${badge.className}`}>{badge.text}</span> : null}
                </div>
                <div className="flex items-center gap-3">
                  {battle.playerLead ? <MiniSprite spriteId={toSpriteId(battle.playerLead)} alt={battle.playerLead} size={48} /> : <span className="size-12" />}
                  <span className="font-display text-xs uppercase tracking-widest text-text-dim">vs</span>
                  {battle.cpuLead ? <MiniSprite spriteId={toSpriteId(battle.cpuLead)} alt={battle.cpuLead} size={48} /> : <span className="size-12" />}
                </div>
                <p className="text-sm text-text-dim">
                  Turno {battle.turn} · {formatWhen(battle.updatedAt)}
                </p>
                <GameLink href={status === "active" ? `/battle/${battle.id}` : `/replay/${battle.id}`} variant="secondary" className="w-full">
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
