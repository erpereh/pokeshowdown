"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiRequestError, apiFetch } from "@/client/api.ts";
import { GameButton } from "@/client/ui/GameButton.tsx";
import { Icon } from "@/client/ui/Icon.tsx";
import { pushToast } from "@/client/ui/Toast.tsx";
import type { ChallengeResponse, ChallengeView, FriendRequestEntry } from "@/shared/contract";
import { connectSocial, onChallengeSignal, refreshSocial, useSocial } from "./store.ts";
import { configSummary, formatCountdown, secondsLeft, useServerClock } from "./time.ts";

/** Dismissed cards stay hidden while the page lives (module level, survives navigations). */
const dismissed = new Set<string>();

function errorText(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : "No se pudo completar la acción.";
}

function ChallengeCard({ challenge, onDismiss }: { challenge: ChallengeView; onDismiss: () => void }) {
  const router = useRouter();
  const now = useServerClock();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const left = secondsLeft(challenge.expiresAt, now);

  async function respond(action: "accept" | "decline") {
    setBusy(action);
    try {
      await apiFetch<ChallengeResponse>(`/api/challenges/${challenge.id}/${action}`, { method: "POST", body: {} });
      onDismiss();
      if (action === "accept") router.push(`/challenge/${challenge.id}`);
      else pushToast("Desafío rechazado.");
    } catch (error) {
      pushToast(errorText(error));
    } finally {
      setBusy(null);
      void refreshSocial();
    }
  }

  return (
    <div role="alertdialog" aria-label={`Desafío de ${challenge.opponent.displayName}`} className="card animate-pop-in pointer-events-auto w-full rounded-[22px] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Icon name="bolt" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold leading-tight">{challenge.opponent.displayName} te desafía</p>
          <p className="mt-0.5 text-xs leading-relaxed text-text-dim">{configSummary(challenge.config)}</p>
          {left !== null ? (
            <p className="mt-0.5 text-xs font-semibold text-text-dim" aria-live="off">Caduca en {formatCountdown(left)}</p>
          ) : null}
        </div>
        <button type="button" aria-label="Ocultar aviso" onClick={onDismiss} className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-dim hover:bg-surface-2">
          <Icon name="close" className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <GameButton size="sm" className="flex-1" loading={busy === "accept"} disabled={busy !== null || left === 0} onClick={() => void respond("accept")}>
          Aceptar
        </GameButton>
        <GameButton size="sm" variant="secondary" className="flex-1" loading={busy === "decline"} disabled={busy !== null} onClick={() => void respond("decline")}>
          Rechazar
        </GameButton>
      </div>
    </div>
  );
}

function RequestCard({ request, onDismiss }: { request: FriendRequestEntry; onDismiss: () => void }) {
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      await apiFetch(`/api/friends/requests/${request.id}/accept`, { method: "POST", body: {} });
      pushToast(`${request.user.displayName} ya es tu amigo.`);
      onDismiss();
    } catch (error) {
      pushToast(errorText(error));
    } finally {
      setBusy(false);
      void refreshSocial();
    }
  }

  return (
    <div role="status" className="card animate-pop-in pointer-events-auto w-full rounded-[22px] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-2/10 text-accent-2">
          <Icon name="friends" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold leading-tight">{request.user.displayName} quiere ser tu amigo</p>
          <p className="mt-0.5 text-xs text-text-dim">Solicitud de amistad</p>
        </div>
        <button type="button" aria-label="Ocultar aviso" onClick={onDismiss} className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-dim hover:bg-surface-2">
          <Icon name="close" className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <GameButton size="sm" className="flex-1" loading={busy} onClick={() => void accept()}>
          Aceptar
        </GameButton>
        <Link href="/friends" onClick={onDismiss} className="game-button font-display inline-flex min-h-12 flex-1 items-center justify-center rounded-full border-2 border-line bg-surface px-4 text-sm font-semibold">
          Ver
        </Link>
      </div>
    </div>
  );
}

/**
 * Mounted by every screen shell. Keeps the social connection alive and shows invitations and
 * friend requests wherever the user is, including during a battle.
 */
export function NotificationCenter({ userId }: { userId: string | null }) {
  const { overview } = useSocial();
  const pathname = usePathname();
  const router = useRouter();
  const [, setTick] = useState(0);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    connectSocial(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    return onChallengeSignal((signal) => {
      const mine = signal.challengerId === userId;
      const current = pathRef.current;
      const onLobby = current === `/challenge/${signal.id}`;
      if (mine && signal.status === "preparing" && !onLobby) {
        if (current.startsWith("/battle/")) pushToast("Tu desafío fue aceptado. Abre Amigos para preparar el equipo.");
        else router.push(`/challenge/${signal.id}`);
      } else if (mine && signal.status === "declined") {
        pushToast("Tu desafío fue rechazado.");
      } else if (mine && signal.status === "expired" && !onLobby) {
        pushToast("Tu desafío caducó sin respuesta.");
      } else if (signal.status === "cancelled" && !onLobby && !mine) {
        pushToast("El desafío fue cancelado.");
      }
    });
  }, [userId, router]);

  if (!userId || !overview) return null;

  const dismiss = (id: string) => {
    dismissed.add(id);
    setTick((value) => value + 1);
  };
  const challenges = overview.challenges.filter(
    (challenge) => challenge.role === "challenged" && challenge.status === "pending" && !dismissed.has(challenge.id),
  );
  const requests = pathname.startsWith("/friends") ? [] : overview.incoming.filter((request) => !dismissed.has(request.id));
  if (challenges.length === 0 && requests.length === 0) return null;

  return (
    <div
      aria-label="Notificaciones"
      className="pointer-events-none fixed inset-x-0 top-[calc(64px+env(safe-area-inset-top)+0.5rem)] z-[65] mx-auto flex w-full max-w-sm flex-col gap-2 px-4 sm:right-4 sm:left-auto sm:mx-0 sm:px-0"
    >
      {challenges.slice(0, 2).map((challenge) => (
        <ChallengeCard key={challenge.id} challenge={challenge} onDismiss={() => dismiss(challenge.id)} />
      ))}
      {requests.slice(0, 2).map((request) => (
        <RequestCard key={request.id} request={request} onDismiss={() => dismiss(request.id)} />
      ))}
    </div>
  );
}
