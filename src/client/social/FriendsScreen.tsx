"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { ApiRequestError, apiFetch, newClientId } from "@/client/api.ts";
import { PokeballDeco } from "@/client/ui/Card.tsx";
import { EmptyState } from "@/client/ui/EmptyState.tsx";
import { ErrorState } from "@/client/ui/ErrorState.tsx";
import { GameButton, Spinner } from "@/client/ui/GameButton.tsx";
import { Icon } from "@/client/ui/Icon.tsx";
import { Modal } from "@/client/ui/Modal.tsx";
import { PageHeader } from "@/client/ui/PageHeader.tsx";
import { SegmentedControl } from "@/client/ui/SegmentedControl.tsx";
import { pushToast } from "@/client/ui/Toast.tsx";
import { typeCardColor } from "@/client/ui/TypeChip.tsx";
import { cx } from "@/client/ui/cx.ts";
import { formatName } from "@/client/ui/format.ts";
import {
  DEFAULT_INVITE_TTL,
  type ChallengeConfig,
  type ChallengeResponse,
  type ChallengeView,
  type FriendEntry,
  type FriendRequestEntry,
  type SendFriendRequestResponse,
} from "@/shared/contract";
import { refreshSocial, useSocial } from "./store.ts";
import { configSummary, copyFriendCode, formatCountdown, formatFriendCode, secondsLeft, useServerClock } from "./time.ts";

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-2/12 font-display text-lg font-bold text-accent-2">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function MyCodeCard({ code }: { code: string }) {
  return (
    <div className="type-card relative overflow-hidden rounded-[24px] p-5" style={{ "--card-color": typeCardColor("Electric") } as CSSProperties}>
      <PokeballDeco className="-bottom-8 -right-6 w-32" />
      <p className="soft-pill gap-1 px-2.5 py-0.5 text-xs"><Icon name="user" className="size-3.5" />Tu código de amigo</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="card-title font-display text-3xl font-bold tracking-[0.12em]" data-testid="my-friend-code" data-code={code}>
          {formatFriendCode(code)}
        </span>
        <button
          type="button"
          onClick={() => void copyFriendCode(code)}
          className="soft-pill press min-h-11 gap-1.5 px-4 text-sm"
          aria-label="Copiar mi código de amigo"
        >
          <Icon name="copy" className="size-4" />Copiar
        </button>
      </div>
      <p className="mt-2 text-sm font-semibold text-white/90">Compártelo para que te añadan. Es permanente.</p>
    </div>
  );
}

function AddFriendCard() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await apiFetch<SendFriendRequestResponse>("/api/friends/requests", { body: { code } });
      setMessage({ tone: "ok", text: response.status === "accepted" ? "¡Ya sois amigos!" : "Solicitud enviada." });
      setCode("");
      void refreshSocial();
    } catch (error) {
      setMessage({ tone: "error", text: errorText(error, "No se pudo enviar la solicitud.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="card rounded-[var(--radius-panel)] p-5">
      <label htmlFor="friend-code" className="font-display text-lg font-bold">Añadir por código</label>
      <div className="mt-3 flex gap-2">
        <input
          id="friend-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          className="font-display min-h-12 min-w-0 flex-1 rounded-full border-2 border-line bg-surface-2 px-4 text-lg font-semibold uppercase tracking-wider outline-none focus:border-accent-2"
        />
        <GameButton type="submit" loading={busy} disabled={!code.trim()}>
          Añadir
        </GameButton>
      </div>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={cx("mt-2 text-sm font-semibold", message.tone === "error" ? "text-danger" : "text-success")}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

function RequestRow({ request, incoming }: { request: FriendRequestEntry; incoming: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: "accept" | "decline" | "cancel") {
    setBusy(action);
    try {
      await apiFetch(`/api/friends/requests/${request.id}/${action}`, { method: "POST", body: {} });
      if (action === "accept") pushToast(`${request.user.displayName} ya es tu amigo.`);
      await refreshSocial();
    } catch (error) {
      pushToast(errorText(error, "No se pudo completar la acción."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="card flex flex-wrap items-center gap-3 rounded-[20px] p-3" data-testid={incoming ? "incoming-request" : "outgoing-request"}>
      <Avatar name={request.user.displayName} />
      <div className="min-w-0 flex-1">
        <p className="font-display truncate font-bold">{request.user.displayName}</p>
        <p className="text-xs text-text-dim">{incoming ? "Quiere ser tu amigo" : "Pendiente de respuesta"}</p>
      </div>
      {incoming ? (
        <div className="flex gap-2">
          <GameButton size="sm" loading={busy === "accept"} disabled={busy !== null} onClick={() => void act("accept")}>Aceptar</GameButton>
          <GameButton size="sm" variant="secondary" loading={busy === "decline"} disabled={busy !== null} onClick={() => void act("decline")}>Rechazar</GameButton>
        </div>
      ) : (
        <GameButton size="sm" variant="ghost" loading={busy === "cancel"} onClick={() => void act("cancel")}>Cancelar</GameButton>
      )}
    </li>
  );
}

function ChallengeRow({ challenge }: { challenge: ChallengeView }) {
  const router = useRouter();
  const now = useServerClock();
  const [busy, setBusy] = useState<string | null>(null);
  const deadline = challenge.status === "pending" ? challenge.expiresAt : challenge.prepareExpiresAt;
  const left = secondsLeft(deadline, now);
  const incoming = challenge.role === "challenged";

  async function act(action: "accept" | "decline" | "cancel") {
    setBusy(action);
    try {
      await apiFetch<ChallengeResponse>(`/api/challenges/${challenge.id}/${action}`, { method: "POST", body: {} });
      if (action === "accept") router.push(`/challenge/${challenge.id}`);
      await refreshSocial();
    } catch (error) {
      pushToast(errorText(error, "No se pudo completar la acción."));
      void refreshSocial();
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="card flex flex-col gap-3 rounded-[20px] p-4 sm:flex-row sm:items-center" data-testid="challenge-row">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><Icon name="bolt" className="size-5" /></span>
        <div className="min-w-0">
          <p className="font-display truncate font-bold">
            {challenge.status === "preparing" ? `Preparando combate con ${challenge.opponent.displayName}` : incoming ? `${challenge.opponent.displayName} te desafía` : `Desafío a ${challenge.opponent.displayName}`}
          </p>
          <p className="text-xs text-text-dim">{configSummary(challenge.config)}</p>
          {left !== null ? <p className="text-xs font-semibold text-text-dim">{challenge.status === "pending" ? "Caduca" : "Preparación"} en {formatCountdown(left)}</p> : null}
        </div>
      </div>
      <div className="flex gap-2">
        {challenge.status === "preparing" ? (
          <Link href={`/challenge/${challenge.id}`} className="game-button is-primary font-display inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white">
            Preparar equipo
          </Link>
        ) : incoming ? (
          <>
            <GameButton size="sm" className="flex-1" loading={busy === "accept"} disabled={busy !== null || left === 0} onClick={() => void act("accept")}>Aceptar</GameButton>
            <GameButton size="sm" variant="secondary" className="flex-1" loading={busy === "decline"} disabled={busy !== null} onClick={() => void act("decline")}>Rechazar</GameButton>
          </>
        ) : (
          <GameButton size="sm" variant="ghost" loading={busy === "cancel"} onClick={() => void act("cancel")}>Cancelar</GameButton>
        )}
      </div>
    </li>
  );
}

function FriendRow({ friend, onChallenge, onRemove }: { friend: FriendEntry; onChallenge: () => void; onRemove: () => void }) {
  return (
    <li className="card flex flex-wrap items-center gap-3 rounded-[20px] p-3" data-testid="friend-row" data-friend-name={friend.displayName}>
      <Avatar name={friend.displayName} />
      <div className="min-w-0 flex-1">
        <p className="font-display truncate font-bold">{friend.displayName}</p>
        <p className="flex items-center gap-1.5 text-xs text-text-dim">
          <span className={cx("presence-dot", friend.online && "is-online")} aria-hidden="true" />
          {friend.online ? "En línea" : "Desconectado"}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {friend.activeBattleId ? (
          <Link href={`/battle/${friend.activeBattleId}`} className="game-button is-primary font-display inline-flex min-h-12 items-center rounded-full bg-accent px-4 text-sm font-semibold text-white">
            Volver al combate
          </Link>
        ) : friend.challengeId ? (
          <Link href={`/challenge/${friend.challengeId}`} className="game-button font-display inline-flex min-h-12 items-center rounded-full border-2 border-line bg-surface px-4 text-sm font-semibold">
            Ver desafío
          </Link>
        ) : (
          <GameButton size="sm" onClick={onChallenge}>
            <Icon name="bolt" className="size-4" />Desafiar
          </GameButton>
        )}
        <button type="button" onClick={onRemove} aria-label={`Eliminar a ${friend.displayName}`} className="flex size-12 items-center justify-center rounded-full text-text-dim hover:bg-danger/10 hover:text-danger">
          <Icon name="trash" className="size-5" />
        </button>
      </div>
    </li>
  );
}

function ChallengeModal({ friend, onClose }: { friend: FriendEntry | null; onClose: () => void }) {
  const router = useRouter();
  const [config, setConfig] = useState<ChallengeConfig>({ formatId: "gen9ou", timerSeconds: null, ouTeamSource: "saved", inviteTtlMinutes: DEFAULT_INVITE_TTL });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId] = useState(() => newClientId());

  async function send() {
    if (!friend) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch<ChallengeResponse>("/api/challenges", { body: { ...config, clientRequestId: requestId, opponentId: friend.userId } });
      pushToast(`Desafío enviado a ${friend.displayName}.`);
      onClose();
      await refreshSocial();
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.body?.challengeId) {
        onClose();
        router.push(`/challenge/${reason.body.challengeId}`);
        return;
      }
      setError(errorText(reason, "No se pudo enviar el desafío."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={friend !== null} title={friend ? `Desafiar a ${friend.displayName}` : "Desafiar"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="font-display mb-2 font-bold">Formato</legend>
          <SegmentedControl
            label="Formato"
            value={config.formatId}
            onChange={(formatId) => setConfig((current) => ({ ...current, formatId }))}
            options={[
              { value: "gen9ou", label: formatName("gen9ou") },
              { value: "gen9randombattle", label: "Random Battle" },
            ]}
          />
        </fieldset>
        <fieldset>
          <legend className="font-display mb-2 font-bold">Temporizador</legend>
          <SegmentedControl
            label="Temporizador"
            value={config.timerSeconds === null ? "none" : String(config.timerSeconds)}
            onChange={(value) => setConfig((current) => ({ ...current, timerSeconds: value === "none" ? null : (Number(value) as 60 | 120) }))}
            options={[
              { value: "none", label: "Sin límite" },
              { value: "60", label: "60 s" },
              { value: "120", label: "120 s" },
            ]}
          />
          <p className="mt-1.5 text-xs text-text-dim">Por decisión. Si se agota, pierde quien no haya elegido.</p>
        </fieldset>
        {config.formatId === "gen9ou" ? (
          <fieldset>
            <legend className="font-display mb-2 font-bold">Equipos permitidos</legend>
            <SegmentedControl
              label="Equipos permitidos"
              value={config.ouTeamSource}
              onChange={(ouTeamSource) => setConfig((current) => ({ ...current, ouTeamSource }))}
              options={[
                { value: "saved", label: "Solo guardados" },
                { value: "saved_or_random", label: "Guardado o aleatorio" },
              ]}
            />
          </fieldset>
        ) : null}
        <fieldset>
          <legend className="font-display mb-2 font-bold">Caducidad de la invitación</legend>
          <SegmentedControl
            label="Caducidad"
            value={String(config.inviteTtlMinutes)}
            onChange={(value) => setConfig((current) => ({ ...current, inviteTtlMinutes: Number(value) as 2 | 5 | 10 }))}
            options={[
              { value: "2", label: "2 min" },
              { value: "5", label: "5 min" },
              { value: "10", label: "10 min" },
            ]}
          />
        </fieldset>
        <p className="rounded-[var(--radius-card)] bg-surface-2 px-4 py-3 text-xs leading-relaxed text-text-dim">
          Team Preview y cláusulas según las reglas oficiales de Showdown. Tu rival verá esta configuración y no podrá cambiarla.
        </p>
        {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
        <GameButton size="lg" loading={busy} onClick={() => void send()}>
          Enviar desafío
        </GameButton>
      </div>
    </Modal>
  );
}

function RemoveModal({ friend, onClose }: { friend: FriendEntry | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!friend) return;
    setBusy(true);
    try {
      await apiFetch(`/api/friends/${friend.userId}`, { method: "DELETE" });
      pushToast(`${friend.displayName} ya no está en tu lista.`);
      onClose();
      await refreshSocial();
    } catch (error) {
      pushToast(errorText(error, "No se pudo eliminar."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={friend !== null} title="Eliminar amigo" onClose={onClose}>
      <p className="text-sm leading-relaxed text-text-dim">
        {friend ? `¿Eliminar a ${friend.displayName} de tus amigos? Se cancelarán los desafíos abiertos entre vosotros.` : null}
      </p>
      <div className="mt-4 flex gap-2">
        <GameButton variant="secondary" className="flex-1" onClick={onClose}>Volver</GameButton>
        <GameButton variant="danger" className="flex-1" loading={busy} onClick={() => void remove()}>Eliminar</GameButton>
      </div>
    </Modal>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="animate-fade-up">
      <h2 className="font-display mb-3 flex items-center gap-2 text-xl font-bold">
        {title}
        {count ? <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">{count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

export function FriendsScreen() {
  const { overview, error } = useSocial();
  const [challengeTarget, setChallengeTarget] = useState<FriendEntry | null>(null);
  const [removeTarget, setRemoveTarget] = useState<FriendEntry | null>(null);

  if (!overview) {
    return (
      <div className="pb-28 lg:pb-0">
        <PageHeader title="Amigos" subtitle="Añade entrenadores con su código y desafíalos online." />
        {error ? (
          <ErrorState title="No se pudo cargar" body="Comprueba tu conexión e inténtalo de nuevo." onRetry={() => void refreshSocial()} />
        ) : (
          <div className="flex justify-center py-12"><Spinner className="size-8" /></div>
        )}
      </div>
    );
  }

  const online = overview.friends.filter((friend) => friend.online).length;

  return (
    <div className="flex flex-col gap-6 pb-28 lg:pb-0">
      <PageHeader title="Amigos" subtitle="Añade entrenadores con su código y desafíalos online." />
      <div className="grid gap-3 md:grid-cols-2">
        <MyCodeCard code={overview.me.friendCode} />
        <AddFriendCard />
      </div>

      {overview.challenges.length > 0 ? (
        <Section title="Desafíos" count={overview.challenges.length}>
          <ul className="stagger flex flex-col gap-2">
            {overview.challenges.map((challenge) => <ChallengeRow key={challenge.id} challenge={challenge} />)}
          </ul>
        </Section>
      ) : null}

      {overview.incoming.length > 0 ? (
        <Section title="Solicitudes recibidas" count={overview.incoming.length}>
          <ul className="stagger flex flex-col gap-2">
            {overview.incoming.map((request) => <RequestRow key={request.id} request={request} incoming />)}
          </ul>
        </Section>
      ) : null}

      <Section title={`Tus amigos${overview.friends.length ? ` · ${online} en línea` : ""}`}>
        {overview.friends.length === 0 ? (
          <EmptyState title="Aún no tienes amigos" body="Comparte tu código o introduce el de otro entrenador para empezar." />
        ) : (
          <ul className="stagger grid gap-2 lg:grid-cols-2">
            {overview.friends.map((friend) => (
              <FriendRow key={friend.userId} friend={friend} onChallenge={() => setChallengeTarget(friend)} onRemove={() => setRemoveTarget(friend)} />
            ))}
          </ul>
        )}
      </Section>

      {overview.outgoing.length > 0 ? (
        <Section title="Solicitudes enviadas" count={overview.outgoing.length}>
          <ul className="stagger flex flex-col gap-2">
            {overview.outgoing.map((request) => <RequestRow key={request.id} request={request} incoming={false} />)}
          </ul>
        </Section>
      ) : null}

      <ChallengeModal key={challengeTarget?.userId ?? "none"} friend={challengeTarget} onClose={() => setChallengeTarget(null)} />
      <RemoveModal friend={removeTarget} onClose={() => setRemoveTarget(null)} />
    </div>
  );
}
