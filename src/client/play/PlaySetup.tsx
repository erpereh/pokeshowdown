"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiRequestError, apiFetch, newClientId } from "@/client/api.ts";
import { MiniSprite } from "@/client/sprites/MiniSprite.tsx";
import { GameButton, GameLink } from "@/client/ui/GameButton.tsx";
import { EmptyState } from "@/client/ui/EmptyState.tsx";
import { PageHeader } from "@/client/ui/PageHeader.tsx";
import { SegmentedControl } from "@/client/ui/SegmentedControl.tsx";
import { formatBlurb, formatName, toSpriteId } from "@/client/ui/format.ts";
import { cx } from "@/client/ui/cx.ts";
import type { CreateBattleResponse, FormatId, ListTeamsResponse, PokemonSetData, RandomTeamResponse, TeamSource, TeamSummary } from "@/shared/contract";

type SideMode = "saved" | "random";

interface SideState {
  mode: SideMode;
  teamId: string | null;
  sets: PokemonSetData[] | null;
}

const INITIAL_SIDE: SideState = { mode: "saved", teamId: null, sets: null };

function sourceOf(side: SideState): TeamSource | null {
  if (side.mode === "saved") {
    if (!side.teamId) return null;
    return { kind: "saved", teamId: side.teamId };
  }
  if (side.sets) return { kind: "inline", sets: side.sets };
  return { kind: "random" };
}

function TeamPreviewGrid({ sets }: { sets: PokemonSetData[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {sets.map((set, index) => (
        <li key={`${set.species}-${index}`} className="min-w-0 rounded-[var(--radius-card)] bg-bg-0/40 p-2 text-center">
          <MiniSprite
            spriteId={toSpriteId(set.species)}
            alt={set.species}
            size={48}
            shiny={set.shiny}
            gender={set.gender === "M" || set.gender === "F" ? set.gender : undefined}
          />
          <p className="truncate text-xs">{set.name || set.species}</p>
        </li>
      ))}
    </ul>
  );
}

function SideEditor({
  title,
  side,
  teams,
  teamsError,
  loadingTeams,
  previewing,
  onChange,
  onPreview,
}: {
  title: string;
  side: SideState;
  teams: TeamSummary[];
  teamsError: string | null;
  loadingTeams: boolean;
  previewing: boolean;
  onChange: (next: SideState) => void;
  onPreview: () => void;
}) {
  return (
    <section className="rounded-[var(--radius-panel)] border border-line bg-surface-solid/40 p-4">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-3">
        <SegmentedControl
          label={`${title}: origen`}
          value={side.mode}
          onChange={(mode) => onChange({ ...side, mode })}
          options={[
            { value: "saved", label: "Guardado" },
            { value: "random", label: "Aleatorio" },
          ]}
        />
      </div>
      {side.mode === "saved" ? (
        <div className="mt-3 flex flex-col gap-2">
          {loadingTeams ? <p className="text-sm text-text-dim">Cargando equipos…</p> : null}
          {teamsError ? <p className="text-sm text-danger">{teamsError}</p> : null}
          {!loadingTeams && !teamsError && teams.length === 0 ? (
            <EmptyState title="Sin equipos" body="Guarda un equipo OU válido para usarlo aquí." action={<GameLink href="/teams/new">Crear equipo</GameLink>} />
          ) : null}
          <ul className="flex flex-col gap-2">
            {teams.map((team) => {
              const selected = side.teamId === team.id;
              return (
                <li key={team.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={!team.valid}
                    aria-pressed={selected}
                    onClick={() => onChange({ ...side, teamId: team.id })}
                    className={cx(
                      "flex min-h-14 w-full items-center gap-2 rounded-[var(--radius-card)] border px-2 py-2 text-left",
                      selected ? "border-accent bg-accent/10" : "border-line bg-bg-0/30",
                      !team.valid && "opacity-60",
                    )}
                  >
                    <span className="flex shrink-0">
                      {team.spriteIds.slice(0, 6).map((spriteId, index) => (
                        <MiniSprite key={`${team.id}-${index}`} spriteId={spriteId} alt="" size={32} className="-ml-1 first:ml-0" />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{team.name}</span>
                    {!team.valid ? <span className="rounded bg-danger/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-danger">No válido</span> : null}
                  </button>
                  {!team.valid ? (
                    <Link href={`/teams/${team.id}`} className="font-display min-h-11 self-start px-1 text-sm font-semibold uppercase text-accent-2">
                      Editar
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-text-dim">Se generará un equipo OU legal. Si lo previsualizas, jugarás exactamente esos seis Pokémon.</p>
          {side.sets ? <TeamPreviewGrid sets={side.sets} /> : null}
          <GameButton type="button" variant="secondary" loading={previewing} onClick={onPreview}>
            {side.sets ? "Regenerar" : "Previsualizar"}
          </GameButton>
        </div>
      )}
    </section>
  );
}

export function PlaySetup({ initialFormat }: { initialFormat: FormatId | null }) {
  const router = useRouter();
  const [formatId, setFormatId] = useState<FormatId | null>(initialFormat);
  const [player, setPlayer] = useState<SideState>(INITIAL_SIDE);
  const [cpu, setCpu] = useState<SideState>({ ...INITIAL_SIDE, mode: "random" });
  const [mobileSide, setMobileSide] = useState<"player" | "cpu">("player");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [previewing, setPreviewing] = useState<"player" | "cpu" | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);

  useEffect(() => {
    if (formatId !== "gen9ou") return;
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
  }, [formatId]);

  async function preview(who: "player" | "cpu") {
    setPreviewing(who);
    setError(null);
    try {
      const response = await apiFetch<RandomTeamResponse>("/api/teams/random", { body: { formatId: "gen9ou" } });
      const apply = who === "player" ? setPlayer : setCpu;
      apply((current) => ({ ...current, mode: "random", sets: response.sets }));
    } catch (reason: unknown) {
      setError(reason instanceof ApiRequestError ? reason.message : "No se pudo generar el equipo.");
    } finally {
      setPreviewing(null);
    }
  }

  async function start() {
    if (!formatId) return;
    const playerSource: TeamSource = formatId === "gen9randombattle" ? { kind: "random" } : (sourceOf(player) ?? { kind: "random" });
    const cpuSource: TeamSource = formatId === "gen9randombattle" ? { kind: "random" } : (sourceOf(cpu) ?? { kind: "random" });
    if (formatId === "gen9ou" && player.mode === "saved" && !player.teamId) {
      setError("Elige un equipo guardado o pasa a aleatorio.");
      return;
    }
    if (formatId === "gen9ou" && cpu.mode === "saved" && !cpu.teamId) {
      setError("Elige el equipo de la CPU o pasa a aleatorio.");
      return;
    }
    const fingerprint = JSON.stringify({ formatId, player: playerSource, cpu: cpuSource });
    if (!requestRef.current || requestRef.current.fingerprint !== fingerprint) {
      requestRef.current = { fingerprint, id: newClientId() };
    }
    setStarting(true);
    setError(null);
    try {
      const response = await apiFetch<CreateBattleResponse>("/api/battles", {
        body: { clientRequestId: requestRef.current.id, formatId, player: playerSource, cpu: cpuSource },
      });
      router.push(`/battle/${response.view.id}`);
    } catch (reason: unknown) {
      if (reason instanceof ApiRequestError && reason.status === 401) {
        router.push(`/auth?next=${encodeURIComponent("/play")}`);
        return;
      }
      setError(reason instanceof ApiRequestError ? reason.message : "No se pudo crear el combate.");
      setStarting(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Un jugador" title="Jugar contra la CPU" subtitle="Elige el formato. En OU configuras tu equipo y el de la CPU por separado." />
      <div className="grid gap-3 sm:grid-cols-2">
        {(["gen9ou", "gen9randombattle"] as const).map((id) => {
          const selected = formatId === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setFormatId(id);
                setError(null);
              }}
              className={cx(
                "min-h-28 rounded-[var(--radius-panel)] border p-4 text-left",
                selected ? "border-accent bg-accent/10 shadow-[0_0_24px_#ffc83d33]" : "border-line bg-surface-solid/40 hover:border-line-strong",
              )}
            >
              <span className="font-display block text-2xl font-bold">{formatName(id)}</span>
              <span className="mt-1 block text-sm text-text-dim">{formatBlurb(id)}</span>
            </button>
          );
        })}
      </div>

      {formatId === "gen9randombattle" ? (
        <p className="mt-6 max-w-2xl text-text-dim">Random Battle usa equipos oficiales generados por Showdown para los dos lados. No hace falta elegir Pokémon: el motor entrega seis sets legales y el combate empieza directamente con el primer Pokémon de cada equipo, sin previsualización.</p>
      ) : null}

      {formatId === "gen9ou" ? (
        <div className="mt-6">
          <div className="mb-3 lg:hidden">
            <SegmentedControl
              label="Lado a configurar"
              value={mobileSide}
              onChange={setMobileSide}
              options={[
                { value: "player", label: "Tu equipo" },
                { value: "cpu", label: "Equipo de la CPU" },
              ]}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={mobileSide === "player" ? "" : "hidden lg:block"}>
              <SideEditor
                title="Tu equipo"
                side={player}
                teams={teams}
                teamsError={teamsError}
                loadingTeams={loadingTeams}
                previewing={previewing === "player"}
                onChange={setPlayer}
                onPreview={() => void preview("player")}
              />
            </div>
            <div className={mobileSide === "cpu" ? "" : "hidden lg:block"}>
              <SideEditor
                title="Equipo de la CPU"
                side={cpu}
                teams={teams}
                teamsError={teamsError}
                loadingTeams={loadingTeams}
                previewing={previewing === "cpu"}
                onChange={setCpu}
                onPreview={() => void preview("cpu")}
              />
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-[var(--radius-card)] border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <GameButton size="lg" disabled={!formatId} loading={starting} onClick={() => void start()}>
          Comenzar combate
        </GameButton>
      </div>
    </div>
  );
}
