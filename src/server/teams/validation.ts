import "server-only";
import type { FormatId, PokemonSetData, ValidationProblem, ValidationResult } from "../../shared/contract/index.ts";
import { createTeamValidator } from "../showdown/index.ts";

function matchesLabel(message: string, label: string): boolean {
  if (!label || message.length < label.length) return false;
  if (!message.toLowerCase().startsWith(label.toLowerCase())) return false;
  const next = message.charAt(label.length);
  return next === "" || /[\s'(:]/.test(next);
}

export function problemSetIndex(message: string, sets: PokemonSetData[]): number | null {
  const line = message.split("\n")[0] ?? message;
  let bestIndex: number | null = null;
  let bestLength = -1;
  for (let index = 0; index < sets.length; index += 1) {
    const set = sets[index];
    if (!set) continue;
    for (const label of [set.name, set.species]) {
      if (!matchesLabel(line, label) || label.length <= bestLength) continue;
      bestIndex = index;
      bestLength = label.length;
    }
  }
  return bestIndex;
}

export function validateTeam(formatId: FormatId, sets: PokemonSetData[]): ValidationResult {
  if (formatId === "gen9randombattle") {
    return {
      valid: false,
      problems: [{ setIndex: null, message: "Random Battle usa equipos generados" }],
    };
  }

  const team = Array.isArray(sets) ? sets : [];
  const problems: ValidationProblem[] = [];
  if (team.length === 0) {
    problems.push({ setIndex: null, message: "El equipo está vacío." });
  }
  if (team.length > 6) {
    problems.push({ setIndex: null, message: "Un equipo puede tener como máximo 6 Pokémon." });
  }

  try {
    const validator = createTeamValidator("gen9ou");
    const messages = validator.validateTeam(team) ?? [];
    for (const message of messages) {
      problems.push({ setIndex: problemSetIndex(message, team), message });
    }
  } catch {
    problems.push({ setIndex: null, message: "No se pudo validar el equipo." });
  }

  return { valid: problems.length === 0, problems };
}
