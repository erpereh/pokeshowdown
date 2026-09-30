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

/** Pokédex card backgrounds: softer than the official chip colours, white bold text keeps ≥3:1 (large text). */
export const TYPE_CARD_COLORS: Record<string, string> = {
  Normal: "#8f9384",
  Fire: "#f0613f",
  Water: "#3f93e8",
  Electric: "#b38600",
  Grass: "#26a377",
  Ice: "#2e9fb5",
  Fighting: "#dd6a2e",
  Poison: "#a05ac8",
  Ground: "#bb8236",
  Flying: "#6f8fe6",
  Psychic: "#ec5b8c",
  Bug: "#7a9a22",
  Rock: "#9d8b45",
  Ghost: "#6e5ca8",
  Dragon: "#5e56de",
  Dark: "#5f504e",
  Steel: "#5f97ab",
  Fairy: "#d862bb",
  Stellar: "#2f9f90",
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

export function typeCardColor(type: string | null | undefined) {
  return (type && TYPE_CARD_COLORS[type]) || "#8f9384";
}

export function typeTextColor(type: string) {
  return LIGHT_TYPES.has(type) ? "#000000" : "#ffffff";
}

export function TypeChip({
  type,
  size = "md",
  tone = "solid",
  className,
}: {
  type: string;
  size?: "sm" | "md";
  /** `soft` is the translucent white pill used on coloured Pokédex cards. */
  tone?: "solid" | "soft";
  className?: string;
}) {
  const sizing = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs";
  if (tone === "soft") {
    return <span className={`soft-pill ${sizing} ${className ?? ""}`}>{TYPE_NAMES_ES[type] ?? type}</span>;
  }
  return (
    <span
      className={`font-display inline-flex items-center justify-center rounded-full font-semibold ${sizing} ${className ?? ""}`}
      style={{ backgroundColor: typeColor(type), color: typeTextColor(type) }}
    >
      {TYPE_NAMES_ES[type] ?? type}
    </span>
  );
}
