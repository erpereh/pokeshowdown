import { createHash } from "node:crypto";

/** Outdoor gen6 backgrounds present as `bg-*.jpg` under `public/assets/generated/sprites/gen6bgs`. */
export const OUTDOOR_BACKGROUNDS = [
  "bg-aquacordetown.jpg",
  "bg-beach.jpg",
  "bg-city.jpg",
  "bg-dampcave.jpg",
  "bg-darkbeach.jpg",
  "bg-darkcity.jpg",
  "bg-darkmeadow.jpg",
  "bg-deepsea.jpg",
  "bg-desert.jpg",
  "bg-earthycave.jpg",
  "bg-forest.jpg",
  "bg-icecave.jpg",
  "bg-meadow.jpg",
  "bg-orasdesert.jpg",
  "bg-orassea.jpg",
  "bg-skypillar.jpg",
] as const;

export function backgroundForBattle(battleId: string): string {
  const digest = createHash("sha256").update(battleId).digest();
  const index = digest.readUInt32BE(0) % OUTDOOR_BACKGROUNDS.length;
  return OUTDOOR_BACKGROUNDS[index] ?? OUTDOOR_BACKGROUNDS[0];
}
