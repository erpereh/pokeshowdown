"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, apiFetch, newClientId } from "@/client/api.ts";
import { pushToast } from "@/client/ui/Toast.tsx";
import { ErrorState } from "@/client/ui/ErrorState.tsx";
import { GameButton, Spinner } from "@/client/ui/GameButton.tsx";
import { Modal } from "@/client/ui/Modal.tsx";
import { Icon } from "@/client/ui/Icon.tsx";
import type { ActionResponse, BattleView, GetBattleResponse, PlayerChoice } from "@/shared/contract";
import { ActionPanel } from "./ActionPanel.tsx";
import { BattleStage } from "./BattleStage.tsx";
import { EndOverlay } from "./EndOverlay.tsx";
import { FieldBar, SpeedSkip } from "./FieldBar.tsx";
import { OnlineHud } from "./OnlineHud.tsx";
import { onMatchSignal } from "@/client/social/store.ts";
import { SpriteWarmup } from "./SpriteWarmup.tsx";
import { useBattlePlayback } from "./useBattlePlayback.ts";

type Pending =
  | { kind: "choice"; choice: PlayerChoice; clientActionId: string; revision: number }
  | { kind: "forfeit"; clientActionId: string; revision: number };

export function BattleScreen({ battleId }: { battleId: string }) {
  const router = useRouter();
  const playback = useBattlePlayback();
  const [view, setView] = useState<BattleView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [netError, setNetError] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const pending = useRef<Pending | null>(null);
  const busy = useRef(false);
  const viewRef = useRef<BattleView | null>(null);
  viewRef.current = view;
  const syncWanted = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await apiFetch<GetBattleResponse>(`/api/battles/${battleId}`);
      setView(response.view);
      playback.hydrate(response.view);
    } catch (reason: unknown) {
      if (reason instanceof ApiRequestError && reason.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(`/battle/${battleId}`)}`);
        return;
      }
      const message = reason instanceof ApiRequestError ? reason.message : "No se pudo cargar el combate.";
      setError(reason instanceof ApiRequestError && reason.status === 404 ? "No encontramos esta partida." : message);
    }
  }, [battleId, playback.hydrate, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyResponse = useCallback(
    async (response: ActionResponse) => {
      setView(response.view);
      if (response.replayed) playback.hydrate(response.view);
      else if (response.newFrames.length > 0) {
        await playback.playNew(response.newFrames);
        playback.hydrate(response.view);
      }
      else playback.hydrate(response.view);
    },
    [playback.hydrate, playback.playNew],
  );

  /**
   * Online: pulls the seat after the rival acted (Realtime signal, polling or an expired timer) and
   * animates only the frames this client has not seen yet. Deferred while an own action is in flight.
   */
  const sync = useCallback(async () => {
    if (busy.current || pending.current) {
      syncWanted.current = true;
      return;
    }
    syncWanted.current = false;
    try {
      const response = await apiFetch<GetBattleResponse>(`/api/battles/${battleId}`);
      if (busy.current || pending.current) {
        syncWanted.current = true;
        return;
      }
      const current = viewRef.current;
      const fresh = response.view;
      if (current && fresh.revision < current.revision) return;
      if (current && fresh.revision === current.revision && fresh.status === current.status) {
        // Same frames: only refresh request/online data (rival chose, presence, deadlines).
        setView(fresh);
        return;
      }
      busy.current = true;
      try {
        setView(fresh);
        const unseen = current ? fresh.frames.filter((frame) => frame.index >= current.revision) : [];
        if (unseen.length > 0) await playback.playNew(unseen);
        playback.hydrate(fresh);
      } finally {
        busy.current = false;
      }
    } catch {
      // Transient; the next signal or poll retries.
    }
  }, [battleId, playback.hydrate, playback.playNew]);

  const fail = useCallback(
    (reason: unknown) => {
      if (reason instanceof ApiRequestError && reason.status === 409 && reason.body?.view) {
        pending.current = null;
        setNetError(false);
        setView(reason.body.view);
        playback.hydrate(reason.body.view);
        return;
      }
      if (reason instanceof ApiRequestError && (reason.status === 422 || reason.code === "invalid_choice")) {
        pending.current = null;
        setNetError(false);
        pushToast(reason.message || "Esa acción no es válida.");
        return;
      }
      if (!(reason instanceof ApiRequestError) || reason.status === 0 || reason.status >= 500) {
        setNetError(true);
        return;
      }
      pending.current = null;
      setNetError(false);
      if (reason.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(`/battle/${battleId}`)}`);
        return;
      }
      pushToast(reason instanceof ApiRequestError ? reason.message : "No se pudo enviar la acción.");
    },
    [battleId, playback.hydrate, router],
  );

  const submit = useCallback(
    async (choice: PlayerChoice) => {
      if (!view?.request || busy.current || pending.current || playback.playing) return;
      busy.current = true;
      const clientActionId = newClientId();
      const revision = view.revision;
      pending.current = { kind: "choice", choice, clientActionId, revision };
      setSending(true);
      setNetError(false);
      try {
        const response = await apiFetch<ActionResponse>(`/api/battles/${battleId}/actions`, {
          body: { clientActionId, revision, choice },
        });
        pending.current = null;
        await applyResponse(response);
      } catch (reason: unknown) {
        fail(reason);
      } finally {
        busy.current = false;
        setSending(false);
        if (syncWanted.current) void sync();
      }
    },
    [applyResponse, battleId, fail, playback.playing, sync, view],
  );

  const forfeit = useCallback(async () => {
    if (!view || busy.current || pending.current || playback.playing) return;
    busy.current = true;
    const clientActionId = newClientId();
    const revision = view.revision;
    pending.current = { kind: "forfeit", clientActionId, revision };
    setForfeitOpen(false);
    setSending(true);
    setNetError(false);
    try {
      const response = await apiFetch<ActionResponse>(`/api/battles/${battleId}/forfeit`, {
        body: { clientActionId, revision },
      });
      pending.current = null;
      await applyResponse(response);
    } catch (reason: unknown) {
      fail(reason);
    } finally {
      busy.current = false;
      setSending(false);
      if (syncWanted.current) void sync();
    }
  }, [applyResponse, battleId, fail, playback.playing, sync, view]);

  const retry = useCallback(async () => {
    const job = pending.current;
    if (!job || busy.current) return;
    busy.current = true;
    setSending(true);
    setNetError(false);
    try {
      const path = job.kind === "forfeit" ? `/api/battles/${battleId}/forfeit` : `/api/battles/${battleId}/actions`;
      const body = job.kind === "forfeit" ? { clientActionId: job.clientActionId, revision: job.revision } : { clientActionId: job.clientActionId, revision: job.revision, choice: job.choice };
      const response = await apiFetch<ActionResponse>(path, { body });
      pending.current = null;
      await applyResponse(response);
    } catch (reason: unknown) {
      fail(reason);
    } finally {
      busy.current = false;
      setSending(false);
      if (syncWanted.current) void sync();
    }
  }, [applyResponse, battleId, fail, sync]);

  const matchId = view?.online?.matchId ?? null;
  const onlineActive = Boolean(view?.online) && view?.status === "active";
  const waitingRival = Boolean(view?.online?.opponentPending);
  useEffect(() => {
    if (!matchId) return;
    return onMatchSignal((changed) => {
      if (changed === matchId) void sync();
    });
  }, [matchId, sync]);
  useEffect(() => {
    if (!matchId || !onlineActive) return;
    // Fallback when a Realtime message is lost: faster while the rival owes a choice.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, waitingRival ? 4000 : 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [matchId, onlineActive, sync, waitingRival]);

  const closeForfeit = useCallback(() => setForfeitOpen(false), []);
  const display = playback.state ?? view?.state ?? null;
  const locked = sending || playback.playing || netError;
  const showEnd = Boolean(view && view.status === "finished" && !playback.playing && !sending);
  const activeName = display?.sides.p1.active?.name;
  const prompt = !locked && view?.request?.kind === "move" && activeName ? `¿Qué debería hacer ${activeName}?` : null;

  if (error) {
    return (
      <div className="flex flex-1 items-center px-4">
        <ErrorState title="Combate no disponible" body={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (!view || !display) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <SpriteWarmup state={display} />
      <BattleStage
        state={display}
        background={view.background}
        bannerTurn={playback.bannerTurn}
        arenaRef={playback.arenaRef}
        lines={playback.lines}
        prompt={prompt}
        muted={showEnd && view.result !== "win"}
        top={
          <FieldBar
            state={display}
            trailing={
              <>
                {view.online ? <OnlineHud online={view.online} active={view.status === "active"} onExpire={() => void sync()} /> : null}
                <SpeedSkip speed={playback.speed} playing={playback.playing} onSpeed={playback.toggleSpeed} onSkip={playback.skip} />
                {view.status === "active" ? (
                  <button
                    type="button"
                    aria-label="Rendirse"
                    title="Rendirse"
                    onClick={() => setForfeitOpen(true)}
                    disabled={locked}
                    className="flex size-12 items-center justify-center rounded-full text-text-dim hover:bg-danger/10 hover:text-danger disabled:opacity-45"
                  >
                    <Icon name="flag" />
                  </button>
                ) : null}
              </>
            }
          />
        }
        bottom={
          <div>
            {netError ? (
              <div className="animate-shake mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card)] border-2 border-danger/30 bg-danger/5 px-3 py-2" role="alert">
                <p className="text-sm">No se pudo confirmar la acción. Reintentar recupera el mismo turno guardado.</p>
                <GameButton type="button" size="md" onClick={() => void retry()} loading={sending}>
                  Reintentar
                </GameButton>
              </div>
            ) : null}
            {showEnd ? null : (
              <ActionPanel
                request={view.request}
                you={display.sides.p1}
                foe={display.sides.p2}
                locked={locked}
                onChoice={(choice) => void submit(choice)}
                onForfeit={view.status === "active" ? () => setForfeitOpen(true) : undefined}
                waitingLabel={view.online ? `Esperando a ${view.online.opponentName}…` : undefined}
              />
            )}
          </div>
        }
        overlay={showEnd ? <EndOverlay view={view} state={display} /> : null}
      />
      <Modal open={forfeitOpen} title="¿Rendirse?" onClose={closeForfeit}>
        <p className="text-sm text-text-dim">
          {view.online ? `La partida contará como derrota y ${view.online.opponentName} ganará.` : "La partida contará como derrota y no podrás retomarla."}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <GameButton type="button" variant="danger" onClick={() => void forfeit()}>
            Rendirse
          </GameButton>
          <GameButton type="button" variant="ghost" onClick={closeForfeit}>
            Seguir luchando
          </GameButton>
        </div>
      </Modal>
    </>
  );
}
