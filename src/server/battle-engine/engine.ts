import "server-only";
import type { FormatId, PlayerRequest, PublicBattleState } from "../../shared/contract/index.ts";
import { CHOICE_PATTERN, type CpuInput } from "../cpu/contract.ts";
import { ENGINE_VERSION } from "../showdown/index.ts";
import { PRNG, Teams } from "../showdown/module.ts";
import { FORFEIT_LINE, choiceToProtocol } from "./choices.ts";
import {
  EngineDesyncError,
  InvalidChoiceError,
  type CreateEngineBattleInput,
  type EngineCheckpoint,
  type EngineSecrets,
  type EngineStep,
  type PlayerAction,
} from "./contract.ts";
import { parseProtocol, presentEvents } from "./protocol-parser.ts";
import { parseShowdownRequest, toPlayerRequest } from "./request-view.ts";
import { projectState } from "./state-tracker.ts";
import { BattleSession } from "./stream.ts";

export interface EngineRunOptions {
  /** Test hook. Production uses `chooseCpuActions` from `src/server/cpu/index.ts`. */
  cpu?: (input: CpuInput) => string[];
}

type ChooseCpu = (input: CpuInput) => string[];

function invalidChoice(message: string): InvalidChoiceError {
  const error = new InvalidChoiceError(message);
  error.name = "InvalidChoiceError";
  return error;
}

function desync(): EngineDesyncError {
  const error = new EngineDesyncError("El estado de la partida no coincide con el motor.");
  error.name = "EngineDesyncError";
  return error;
}

function sanitizeShowdownMessage(message: string): string {
  const cleaned = message.replace(/[\u0000-\u001f|>]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 300) || "Elección inválida.";
}

function asSeed(seed: string): ReturnType<typeof PRNG.generateSeed> {
  if (!seed.startsWith("sodium,")) throw new Error("La semilla debe ser un seed sodium de Showdown.");
  return seed as ReturnType<typeof PRNG.generateSeed>;
}

function deriveSeed(base: ReturnType<typeof PRNG.generateSeed>, hops: number): ReturnType<typeof PRNG.generateSeed> {
  const prng = new PRNG(base);
  for (let hop = 0; hop < hops; hop += 1) prng.random();
  return prng.getSeed();
}

function endReasonFor(lines: readonly string[], ended: boolean): "normal" | "forfeit" | null {
  if (!ended) return null;
  return lines.some((line) => line.startsWith(">forcelose ")) ? "forfeit" : "normal";
}

function normalizeCpuChoices(proposed: unknown): string[] {
  const ordered: string[] = [];
  const list = Array.isArray(proposed) ? proposed : [];
  for (const choice of [...list, "default"]) {
    if (typeof choice !== "string") continue;
    if (!CHOICE_PATTERN.test(choice)) continue;
    if (choice.includes("\n") || choice.includes("\r") || choice.includes(">") || choice.includes("|")) continue;
    if (!ordered.includes(choice)) ordered.push(choice);
  }
  return ordered;
}

async function resolveCpu(options?: EngineRunOptions): Promise<ChooseCpu> {
  if (options?.cpu) return options.cpu;
  const href = new URL("../cpu/index.ts", import.meta.url).href;
  const loaded = (await import(href)) as { chooseCpuActions?: ChooseCpu };
  if (typeof loaded.chooseCpuActions !== "function") throw new Error("chooseCpuActions no está disponible.");
  return loaded.chooseCpuActions;
}

function openingLines(input: CreateEngineBattleInput): { secrets: EngineSecrets; lines: string[] } {
  if (input.formatId !== "gen9ou" && input.formatId !== "gen9randombattle") {
    throw new Error("Formato no soportado.");
  }
  const seed = asSeed(input.seed ?? PRNG.generateSeed());
  let p1Team = input.p1Team ?? "";
  let p2Team = input.p2Team ?? "";
  if (input.formatId === "gen9randombattle") {
    p1Team = Teams.pack(Teams.generate("gen9randombattle", { seed: deriveSeed(seed, 1) }));
    p2Team = Teams.pack(Teams.generate("gen9randombattle", { seed: deriveSeed(seed, 2) }));
  } else if (!p1Team || !p2Team) {
    throw new Error("gen9ou requiere equipos empaquetados.");
  }

  const lines = [
    `>start ${JSON.stringify({ formatid: input.formatId, seed })}`,
    `>player p1 ${JSON.stringify({ name: "Player", team: p1Team })}`,
    `>player p2 ${JSON.stringify({ name: "CPU", team: p2Team })}`,
  ];
  return {
    lines,
    secrets: {
      formatId: input.formatId,
      engineVersion: ENGINE_VERSION,
      seed,
      p1Team,
      p2Team,
      inputLog: lines,
    },
  };
}

function buildStep(
  session: BattleSession,
  formatId: FormatId,
  beforeP1: number,
  lines: readonly string[],
  inputLogDelta: string[],
): EngineStep {
  const p1Lines = session.p1Lines;
  const parsed = parseProtocol(p1Lines, "p1", formatId);
  const prefixCount = beforeP1 === 0 ? 0 : parseProtocol(p1Lines.slice(0, beforeP1), "p1", formatId).length;
  const events = presentEvents(parsed.slice(prefixCount));
  const ended = session.ended;
  const requestRaw = ended ? null : session.requestRaw("p1");
  const requestParsed = requestRaw ? parseShowdownRequest(requestRaw) : null;
  const state: PublicBattleState = projectState(parsed, "p1", requestParsed, ended);
  const request: PlayerRequest | null = ended ? null : toPlayerRequest(requestParsed, formatId);
  return {
    inputLogDelta,
    events,
    state,
    request,
    checkpoint: { turn: session.turn, p1RequestRaw: requestRaw },
    turn: session.turn,
    ended,
    winner: session.winner(),
    endReason: endReasonFor(lines, ended),
  };
}

async function advanceCpu(
  session: BattleSession,
  written: string[],
  formatId: FormatId,
  seed: string,
  choose: ChooseCpu,
): Promise<void> {
  for (let guard = 0; guard < 50; guard += 1) {
    if (session.ended || !session.isActionable("p2") || session.isActionable("p1")) return;
    const request = session.parsedRequest("p2");
    if (!request) return;
    const view = projectState(parseProtocol(session.p2Lines, "p2", formatId), "p2", request, false);
    const input: CpuInput = {
      formatId,
      self: "p2",
      request,
      view,
      seedKey: `${seed}:${written.length}`,
    };
    let proposed: unknown = ["default"];
    try {
      proposed = choose(input);
    } catch {
      proposed = ["default"];
    }
    let accepted = false;
    for (const choice of normalizeCpuChoices(proposed)) {
      const epoch = session.epoch("p2");
      const errors = await session.writeLine(`>p2 ${choice}`);
      if (errors.some((error) => error.side === "p2")) continue;
      if (session.epoch("p2") === epoch) session.lock("p2");
      written.push(`>p2 ${choice}`);
      accepted = true;
      break;
    }
    if (!accepted) throw new Error("La CPU no pudo elegir.");
  }
  if (!session.ended && session.isActionable("p2") && !session.isActionable("p1")) {
    throw new Error("La CPU superó el límite de 50 acciones.");
  }
}

async function withSession<T>(run: (session: BattleSession) => Promise<T>): Promise<T> {
  const session = new BattleSession();
  try {
    return await run(session);
  } finally {
    await session.destroy();
  }
}

export async function createEngineBattle(
  input: CreateEngineBattleInput,
  options?: EngineRunOptions,
): Promise<{ secrets: EngineSecrets; step: EngineStep }> {
  const choose = await resolveCpu(options);
  const { secrets, lines } = openingLines(input);
  const written = [...lines];
  const step = await withSession(async (session) => {
    await session.replay(lines);
    await advanceCpu(session, written, secrets.formatId, secrets.seed, choose);
    secrets.inputLog = [...written];
    return buildStep(session, secrets.formatId, 0, written, [...written]);
  });
  return { secrets, step };
}

export async function applyPlayerAction(
  secrets: EngineSecrets,
  checkpoint: EngineCheckpoint,
  action: PlayerAction,
  options?: EngineRunOptions,
): Promise<EngineStep> {
  const choose = await resolveCpu(options);
  return withSession(async (session) => {
    await session.replay(secrets.inputLog);
    const requestRaw = session.ended ? null : session.requestRaw("p1");
    if (session.turn !== checkpoint.turn || requestRaw !== checkpoint.p1RequestRaw) throw desync();

    const before = session.p1Lines.length;
    const written = [...secrets.inputLog];
    if (session.ended) throw invalidChoice("La batalla ya terminó.");

    if (action.kind === "forfeit") {
      await session.writeLine(FORFEIT_LINE);
      written.push(FORFEIT_LINE);
    } else {
      if (!session.isActionable("p1")) throw invalidChoice("No hay una decisión pendiente.");
      if (action.choice.kind === "teamPreview") {
        const pending = session.parsedRequest("p1");
        const size = pending?.maxChosenTeamSize ?? pending?.side.pokemon.length;
        if (!pending?.teamPreview || action.choice.order.length !== size) {
          throw invalidChoice("El orden debe incluir todos los Pokémon del equipo.");
        }
      }
      const token = choiceToProtocol(action.choice);
      const epoch = session.epoch("p1");
      const errors = await session.writeLine(`>p1 ${token}`);
      const rejected = errors.find((error) => error.side === "p1");
      if (rejected) throw invalidChoice(sanitizeShowdownMessage(rejected.message));
      if (session.epoch("p1") === epoch) session.lock("p1");
      written.push(`>p1 ${token}`);
      await advanceCpu(session, written, secrets.formatId, secrets.seed, choose);
    }

    return buildStep(session, secrets.formatId, before, written, written.slice(secrets.inputLog.length));
  });
}

export async function rebuildView(secrets: EngineSecrets): Promise<EngineStep> {
  return withSession(async (session) => {
    await session.replay(secrets.inputLog);
    return buildStep(session, secrets.formatId, 0, secrets.inputLog, []);
  });
}

/** Channel lines after stripping `|t:|`, for determinism checks. */
export async function readPerspectiveLog(secrets: EngineSecrets): Promise<{ p1: string[]; p2: string[] }> {
  return withSession(async (session) => {
    await session.replay(secrets.inputLog);
    return { p1: [...session.p1Lines], p2: [...session.p2Lines] };
  });
}
