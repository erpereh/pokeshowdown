export const TYPE_COLORS: Record<string, string> = {
  Normal: "#9fa19f",
  Fire: "#e62829",
  Water: "#2980ef",
  Electric: "#fac000",
  Grass: "#3fa129",
  Ice: "#3dcef3",
  Fighting: "#ff8000",
  Poison: "#9141cb",
  Ground: "#915121",
  Flying: "#81b9ef",
  Psychic: "#ef4179",
  Bug: "#91a119",
  Rock: "#afa981",
  Ghost: "#704170",
  Dragon: "#5060e1",
  Dark: "#624d4e",
  Steel: "#60a1b8",
  Fairy: "#ef70ef",
  Stellar: "#40b5a5",
};

export const TYPE_NAMES_ES: Record<string, string> = {
  Normal: "Normal",
  Fire: "Fuego",
  Water: "Agua",
  Electric: "Eléctrico",
  Grass: "Planta",
  Ice: "Hielo",
  Fighting: "Lucha",
  Poison: "Veneno",
  Ground: "Tierra",
  Flying: "Volador",
  Psychic: "Psíquico",
  Bug: "Bicho",
  Rock: "Roca",
  Ghost: "Fantasma",
  Dragon: "Dragón",
  Dark: "Siniestro",
  Steel: "Acero",
  Fairy: "Hada",
  Stellar: "Astral",
};

/** Types whose colour is light enough to need dark text for 4.5:1 contrast. */
const LIGHT_TYPES = new Set(["Normal", "Fire", "Water", "Electric", "Ice", "Fighting", "Flying", "Psychic", "Rock", "Grass", "Bug", "Stellar", "Fairy", "Steel"]);

export function typeColor(type: string) {
  return TYPE_COLORS[type] ?? "#9aa4c0";
}

export function typeTextColor(type: string) {
  return LIGHT_TYPES.has(type) ? "#000000" : "#ffffff";
}

export function TypeChip({ type, size = "md", className }: { type: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={`font-display inline-flex items-center justify-center rounded-full font-semibold ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${className ?? ""}`}
      style={{ backgroundColor: typeColor(type), color: typeTextColor(type) }}
    >
      {TYPE_NAMES_ES[type] ?? type}
    </span>
  );
}
