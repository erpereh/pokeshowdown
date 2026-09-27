import "server-only";
import { chooseCpuActions } from "../cpu/index.ts";
import type { CpuInput } from "../cpu/contract.ts";
import {
  applyPlayerAction as applyPlayerActionWithCpu,
  createEngineBattle as createEngineBattleWithCpu,
  readPerspectiveLog,
  rebuildView,
} from "./engine.ts";
import type { CreateEngineBattleInput, EngineCheckpoint, EngineSecrets, PlayerAction } from "./contract.ts";

export { EngineDesyncError, InvalidChoiceError } from "./contract.ts";
export type {
  CreateEngineBattleInput,
  EngineCheckpoint,
  EngineSecrets,
  EngineStep,
  PlayerAction,
} from "./contract.ts";

function cpu(input: CpuInput): string[] {
  return chooseCpuActions(input);
}

export function createEngineBattle(input: CreateEngineBattleInput) {
  return createEngineBattleWithCpu(input, { cpu });
}

export function applyPlayerAction(secrets: EngineSecrets, checkpoint: EngineCheckpoint, action: PlayerAction) {
  return applyPlayerActionWithCpu(secrets, checkpoint, action, { cpu });
}

export { readPerspectiveLog, rebuildView };
