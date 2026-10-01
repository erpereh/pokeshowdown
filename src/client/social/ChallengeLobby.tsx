"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ApiRequestError, apiFetch } from "@/client/api.ts";
import { SavedTeamList, TeamPreviewGrid } from "@/client/play/TeamPicker.tsx";
import { PokeballDeco } from "@/client/ui/Card.tsx";
import { EmptyState } from "@/client/ui/EmptyState.tsx";
import { ErrorState } from "@/client/ui/ErrorState.tsx";
import { GameButton, GameLink, Spinner } from "@/client/ui/GameButton.tsx";
import { Icon } from "@/client/ui/Icon.tsx";
import { PageHeader } from "@/client/ui/PageHeader.tsx";
import { SegmentedControl } from "@/client/ui/SegmentedControl.tsx";
import { cx } from "@/client/ui/cx.ts";
import { formatName } from "@/client/ui/format.ts";
import type { ChallengeResponse, ChallengeTeamPick, ChallengeView, ListTeamsResponse, TeamSummary } from "@/shared/contract";
import { onChallengeSignal, refreshSocial, skewFrom, useSocial } from "./store.ts";
import { formatCountdown, secondsLeft, timerLabel } from "./time.ts";

const CLOSED_TEXT: Record<string, { title: string; body: string }> = {
  declined: { title: "Desafío rechazado", body: "Tu rival no aceptó esta vez." },
  cancelled: { title: "Desafío cancelado", body: "Uno de los jugadores canceló el desafío." },
  expired: { title: "Desafío caducado", body: "Se agotó el tiempo para responder o preparar los equipos." },
};

function useLobbyClock(challenge: ChallengeView | null): number {
  const skew = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (challenge) skew.current = skewFrom(challenge.serverNow);
  }, [challenge]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function PlayerCard({ label, name, ready, online }: { label: string; name: string; ready: boolean; online?: boolean }) {
  return (
    <div className="card flex items-center gap-3 rounded-[20px] p-3" data-testid={`lobby-${label === "Tú" ? "me" : "rival"}`} data-ready={ready}>
      <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-2/12 font-display text-lg font-bold text-accent-2">
        {name.slice(0, 1).toUpperCase()}
        {online === undefined ? null : <span className={cx("presence-dot absolute -bottom-0.5 -right-0.5 border-2 border-surface", online && "is-online")} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">{label}</p>
        <p className="font-display truncate font-bold">{name}</p>
      </div>
      <span className={cx("rounded-full px-3 py-1 text-xs font-bold", ready ? "bg-success/12 text-success" : "bg-surface-2 text-text-dim")}>
        {ready ? "Listo" : "Preparando"}
      </span>
    </div>
  );
}

export function ChallengeLobby({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<ChallengeView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamMode, setTeamMode] = useState<"saved" | "random">("saved");
  const [teamId, setTeamId] = useState<string | null>(null);
  const now = useLobbyClock(challenge);
  const myName = useSocial().overview?.me.displayName ?? "Tú";

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<ChallengeResponse>(`/api/challenges/${challengeId}`);
      setChallenge(response.challenge);
      setLoadError(null);
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(`/challenge/${challengeId}`)}`);
        return;
      }
      setLoadError(reason instanceof ApiRequestError ? reason.message : "No se pudo cargar el desafío.");
    }
  }, [challengeId, router]);

  useEffect(() => {
    void load();
    const off = onChallengeSignal((signal) => {
      if (signal.id === challengeId) void load();
    });
    // Polling fallback in case a Realtime message is missed (reconnection, background tab).
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [challengeId, load]);

  useEffect(() => {
    if (challenge?.status === "started" && challenge.battleId) router.replace(`/battle/${challenge.battleId}`);
  }, [challenge, router]);

  const needsTeams = challenge?.status === "preparing" && challenge.config.formatId === "gen9ou";
  useEffect(() => {
    if (!needsTeams) return;
    let cancelled = false;
    setLoadingTeams(true);
    apiFetch<ListTeamsResponse>("/api/teams")
      .then((response) => {
        if (!cancelled) setTeams(response.teams.filter((team) => team.formatId === "gen9ou"));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setTeamsError(reason instanceof ApiRequestError ? reason.message : "No se pudieron cargar los equipos.");
      })
      .finally(() => {
        if (!cancelled) setLoadingTeams(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsTeams]);

  async function post(action: string, body: unknown = {}) {
    setBusy(action);
    setError(null);
    try {
      const response = await apiFetch<ChallengeResponse>(`/api/challenges/${challengeId}/${action}`, { body });
      setChallenge(response.challenge);
      void refreshSocial();
    } catch (reason) {
      const message = reason instanceof ApiRequestError ? reason.message : "No se pudo completar la acción.";
      setError(message);
      if (reason instanceof ApiRequestError && (reason.status === 409 || reason.status === 410)) void load();
    } finally {
      setBusy(null);
    }
  }

  function ready() {
    if (!challenge) return;
    let team: ChallengeTeamPick | undefined;
    if (challenge.config.formatId === "gen9ou") {
      if (teamMode === "random") team = { kind: "random" };
      else if (teamId) team = { kind: "saved", teamId };
      else {
        setError("Elige un equipo guardado.");
        return;
      }
    }
    void post("ready", { ready: true, team });
  }

  if (loadError && !challenge) {
    return <ErrorState title="Desafío no disponible" body={loadError} onRetry={() => void load()} />;
  }
  if (!challenge) {
    return <div className="flex justify-center py-16"><Spinner className="size-8" /></div>;
  }

  const closed = CLOSED_TEXT[challenge.status];
  if (closed) {
    return (
      <div className="pb-28 lg:pb-0">
        <PageHeader title="Desafío" backHref="/friends" />
        <EmptyState title={closed.title} body={closed.body} action={<GameLink href="/friends">Volver a Amigos</GameLink>} />
      </div>
    );
  }
  if (challenge.status === "started") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Spinner className="size-8" />
        <p className="font-display font-bold">¡Comienza el combate!</p>
      </div>
    );
  }

  const { config, opponent } = challenge;
  const isOu = config.formatId === "gen9ou";
  const allowRandom = config.ouTeamSource === "saved_or_random";
  const deadline = challenge.status === "pending" ? challenge.expiresAt : challenge.prepareExpiresAt;
  const left = secondsLeft(deadline, now);

  return (
    <div className="flex flex-col gap-5 pb-28 lg:pb-0">
      <PageHeader title={`Desafío contra ${opponent.displayName}`} backHref="/friends" />

      <div className="type-card relative overflow-hidden rounded-[24px] p-5" style={{ "--card-color": isOu ? "#4a63e8" : "#f0613f" } as CSSProperties} data-testid="challenge-config">
        <PokeballDeco className="-bottom-10 -right-8 w-36" />
        <p className="soft-pill gap-1 px-2.5 py-0.5 text-xs"><Icon name="flag" className="size-3.5" />Reglas fijadas por {challenge.role === "challenger" ? "ti" : opponent.displayName}</p>
        <p className="card-title font-display mt-2 text-2xl font-bold">{formatName(config.formatId)}</p>
        <ul className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
          <li className="soft-pill px-2.5 py-0.5">{timerLabel(config.timerSeconds)}</li>
          {isOu ? <li className="soft-pill px-2.5 py-0.5">{allowRandom ? "Equipo guardado o aleatorio" : "Solo equipos guardados"}</li> : null}
          <li className="soft-pill px-2.5 py-0.5">Invitación de {config.inviteTtlMinutes} min</li>
          <li className="soft-pill px-2.5 py-0.5">Team Preview oficial</li>
        </ul>
        {left !== null ? (
          <p className="mt-3 text-sm font-semibold text-white/90" aria-live="off">
            {challenge.status === "pending" ? "La invitación caduca en " : "Tiempo para prepararse: "}
            <span data-testid="lobby-countdown">{formatCountdown(left)}</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <PlayerCard label="Tú" name={myName} ready={challenge.me.ready} />
        <PlayerCard label="Rival" name={opponent.displayName} ready={opponent.ready} online={opponent.online} />
      </div>

      {challenge.status === "pending" ? (
        challenge.role === "challenged" ? (
          <div className="card flex flex-col gap-3 rounded-[var(--radius-panel)] p-5">
            <p className="text-sm text-text-dim">Al aceptar, ambos elegiréis equipo y pulsaréis «Listo». Las reglas no se pueden cambiar.</p>
            <div className="flex gap-2">
              <GameButton className="flex-1" loading={busy === "accept"} disabled={busy !== null || left === 0} onClick={() => void post("accept")}>Aceptar desafío</GameButton>
              <GameButton className="flex-1" variant="secondary" loading={busy === "decline"} disabled={busy !== null} onClick={() => void post("decline")}>Rechazar</GameButton>
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-3 rounded-[var(--radius-panel)] p-6 text-center">
            <Spinner className="size-7" />
            <p className="font-display font-bold">Esperando a que {opponent.displayName} responda…</p>
            <GameButton variant="ghost" loading={busy === "cancel"} onClick={() => void post("cancel")}>Cancelar desafío</GameButton>
          </div>
        )
      ) : null}

      {challenge.status === "preparing" ? (
        <section className="card flex flex-col gap-3 rounded-[var(--radius-panel)] p-5">
          <h2 className="font-display text-xl font-bold">{isOu ? "Tu equipo" : "Equipos oficiales"}</h2>
          {!isOu ? (
            <p className="text-sm text-text-dim">Showdown genera seis Pokémon para cada jugador al empezar. Solo tienes que confirmar.</p>
          ) : challenge.me.ready ? (
            challenge.me.team ? <TeamPreviewGrid sets={challenge.me.team} /> : null
          ) : (
            <>
              {allowRandom ? (
                <SegmentedControl
                  label="Origen del equipo"
                  value={teamMode}
                  onChange={setTeamMode}
                  options={[
                    { value: "saved", label: "Guardado" },
                    { value: "random", label: "Aleatorio" },
                  ]}
                />
              ) : null}
              {teamMode === "saved" || !allowRandom ? (
                <SavedTeamList teams={teams} error={teamsError} loading={loadingTeams} selectedId={teamId} onSelect={setTeamId} />
              ) : (
                <p className="text-sm text-text-dim">Se generará un equipo OU legal al confirmar. Lo verás aquí antes de empezar.</p>
              )}
            </>
          )}
          {challenge.me.ready ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm font-semibold text-success" data-testid="waiting-rival">
                {opponent.ready ? "¡Ambos listos! Iniciando…" : `Listo. Esperando a ${opponent.displayName}…`}
              </p>
              <GameButton variant="secondary" loading={busy === "ready"} onClick={() => void post("ready", { ready: false })}>Cambiar</GameButton>
            </div>
          ) : (
            <GameButton size="lg" loading={busy === "ready"} disabled={busy !== null || (isOu && (teamMode === "saved" || !allowRandom) && !teamId)} onClick={ready}>
              ¡Listo!
            </GameButton>
          )}
          <GameButton variant="ghost" loading={busy === "cancel"} disabled={busy !== null} onClick={() => void post("cancel")}>
            Abandonar desafío
          </GameButton>
        </section>
      ) : null}

      {error ? <p role="alert" className="rounded-[var(--radius-card)] border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
