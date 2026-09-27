"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, apiFetch, newClientId } from "@/client/api.ts";
import { pushToast } from "@/client/ui/Toast.tsx";
import { ErrorState } from "@/client/ui/ErrorState.tsx";
import { GameButton, Spinner } from "@/client/ui/GameButton.tsx";
import { Modal } from "@/client/ui/Modal.tsx";
import type { ActionResponse, BattleView, GetBattleResponse, PlayerChoice } from "@/shared/contract";
import { ActionPanel } from "./ActionPanel.tsx";
import { BattleStage } from "./BattleStage.tsx";
import { EndOverlay } from "./EndOverlay.tsx";
import { FieldBar, SpeedSkip } from "./FieldBar.tsx";
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
      }
    },
    [applyResponse, battleId, fail, playback.playing, view],
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
    }
  }, [applyResponse, battleId, fail, playback.playing, view]);

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
    }
  }, [applyResponse, battleId, fail]);

  const closeForfeit = useCallback(() => setForfeitOpen(false), []);
  const display = playback.state ?? view?.state ?? null;
  const locked = sending || playback.playing || netError;
  const showEnd = Boolean(view && view.status === "finished" && !playback.playing && !sending);

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
        muted={showEnd && view.result !== "win"}
        top={
          <FieldBar
            state={display}
            trailing={
              <>
                <SpeedSkip speed={playback.speed} playing={playback.playing} onSpeed={playback.toggleSpeed} onSkip={playback.skip} />
                {view.status === "active" ? (
                  <GameButton type="button" variant="danger" size="md" onClick={() => setForfeitOpen(true)} disabled={locked}>
                    Rendirse
                  </GameButton>
                ) : null}
              </>
            }
          />
        }
        bottom={
          <div>
            {netError ? (
              <div className="mx-2 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card)] border border-danger/50 bg-danger/10 px-3 py-2" role="alert">
                <p className="text-sm">No se pudo confirmar la acción. Reintentar recupera el mismo turno guardado.</p>
                <GameButton type="button" size="md" onClick={() => void retry()} loading={sending}>
                  Reintentar
                </GameButton>
              </div>
            ) : null}
            {showEnd ? null : (
              <ActionPanel request={view.request} you={display.sides.p1} foe={display.sides.p2} locked={locked} onChoice={(choice) => void submit(choice)} />
            )}
          </div>
        }
        overlay={showEnd ? <EndOverlay view={view} state={display} /> : null}
      />
      <Modal open={forfeitOpen} title="¿Rendirse?" onClose={closeForfeit}>
        <p className="text-sm text-text-dim">La partida contará como derrota y no podrás retomarla.</p>
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
