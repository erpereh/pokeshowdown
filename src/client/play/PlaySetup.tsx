"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ApiRequestError, apiFetch, newClientId } from "@/client/api.ts";
import { GameButton } from "@/client/ui/GameButton.tsx";
import { PageHeader } from "@/client/ui/PageHeader.tsx";
import { SegmentedControl } from "@/client/ui/SegmentedControl.tsx";
import { formatBlurb, formatName } from "@/client/ui/format.ts";
import { Icon } from "@/client/ui/Icon.tsx";
import { PokeballDeco } from "@/client/ui/Card.tsx";
import { PokemonSprite } from "@/client/sprites/PokemonSprite.tsx";
import { DuelHero } from "@/client/home/DuelHero.tsx";
import { SavedTeamList, TeamPreviewGrid } from "./TeamPicker.tsx";
import { typeCardColor } from "@/client/ui/TypeChip.tsx";
import type { CreateBattleResponse, FormatId, ListBattlesResponse, ListTeamsResponse, PokemonSetData, RandomTeamResponse, TeamSource, TeamSummary } from "@/shared/contract";

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
    <section className="card rounded-[var(--radius-panel)] p-4 sm:p-5">
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
        <SavedTeamList
          teams={teams}
          error={teamsError}
          loading={loadingTeams}
          selectedId={side.teamId}
          onSelect={(teamId) => onChange({ ...side, teamId })}
        />
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
  const [continueId, setContinueId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ListBattlesResponse>("/api/battles?status=active")
      .then((response) => { if (!cancelled) setContinueId(response.battles[0]?.id ?? null); })
      .catch(() => { if (!cancelled) setContinueId(null); });
    return () => { cancelled = true; };
  }, []);

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
    <div className="pb-28 lg:pb-0">
      <PageHeader title="¿Listo para combatir?" />
      <div className="grid gap-3 md:grid-cols-[1.35fr_1fr] md:items-start">
        <DuelHero compact />
        {continueId ? (
          <Link
            href={`/battle/${continueId}`}
            className="type-card press animate-fade-up flex min-h-24 items-center justify-between gap-3 rounded-[24px] p-4"
            style={{ "--card-color": typeCardColor("Water") } as CSSProperties}
          >
            <PokeballDeco className="-bottom-6 -right-6 w-24" />
            <span>
              <span className="card-title font-display block text-lg font-bold leading-tight">Continuar partida</span>
              <span className="soft-pill mt-2 gap-1 px-2 py-0.5 text-[11px]"><Icon name="saved" className="size-3.5" />En curso</span>
            </span>
            <Icon name="arrow" className="size-6 shrink-0" />
          </Link>
        ) : null}
      </div>
      <h2 className="font-display mb-3 mt-6 text-xl font-bold">Elige formato</h2>
      <div className="stagger grid gap-3 sm:grid-cols-2">
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
              className="format-option type-card press p-5 pr-28 text-left"
              style={{ "--card-color": id === "gen9ou" ? "#4a63e8" : "#f0613f" } as CSSProperties}
            >
              <PokeballDeco className="-bottom-10 -right-8 w-36" />
              <span className="animate-float pointer-events-none absolute bottom-2 right-3 w-28">
                <PokemonSprite spriteId={id === "gen9ou" ? "gholdengo" : "zoroark"} facing="front" animated={false} scale={1.5} alt="" className="drop-shadow-[0_6px_6px_rgb(0_0_0/0.2)]" />
              </span>
              <span className="soft-pill mb-3 gap-1.5 px-2.5 py-0.5 text-xs"><Icon name={id === "gen9ou" ? "team" : "spark"} className="size-3.5" />{id === "gen9ou" ? "Tu estrategia" : "Listo para jugar"}</span>
              <span className="card-title font-display block text-2xl font-bold">{formatName(id)}</span>
              <span className="mt-1 block text-sm font-semibold text-white/90">{formatBlurb(id)}</span>
              {selected ? <span className="soft-pill animate-pop-in mt-3 px-2.5 py-0.5 text-xs">✓ Seleccionado</span> : null}
            </button>
          );
        })}
      </div>

      {formatId === "gen9randombattle" ? (
        <p className="card animate-fade-up mt-5 rounded-[var(--radius-panel)] p-5 text-sm leading-relaxed text-text-dim">Seis Pokémon sorpresa para cada lado. Entra directamente al combate, sin preparar equipos.</p>
      ) : null}

      {formatId === "gen9ou" ? (
        <div className="animate-fade-up mt-6">
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

      <div className="setup-footer">
        <div className="card flex items-center gap-4">
        <p className="font-display hidden flex-1 pl-3 text-sm font-semibold text-text-dim sm:block">{formatId ? formatName(formatId) : "Selecciona un formato"}</p>
        <GameButton size="lg" className="w-full sm:w-auto" disabled={!formatId || previewing !== null} loading={starting} onClick={() => void start()}>
          Comenzar combate
        </GameButton>
        </div>
      </div>
    </div>
  );
}
