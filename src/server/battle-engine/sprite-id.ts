import "server-only";
import { Dex, toID } from "../showdown/module.ts";

const cache = new Map<string, string>();

/** `toID(baseSpecies)` plus `-toID(forme)` when the species has a forme. */
export function spriteIdForSpecies(speciesName: string): string {
  const cached = cache.get(speciesName);
  if (cached) return cached;

  const species = Dex.species.get(speciesName);
  let spriteId: string;
  if (!species.exists) {
    spriteId = toID(speciesName);
  } else if (species.forme) {
    spriteId = `${toID(species.baseSpecies)}-${toID(species.forme)}`;
  } else {
    spriteId = toID(species.baseSpecies);
  }
  cache.set(speciesName, spriteId);
  return spriteId;
}
