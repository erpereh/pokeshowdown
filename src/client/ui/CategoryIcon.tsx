import type { MoveCategory } from "@/shared/contract";

const LABEL: Record<MoveCategory, string> = {
  Physical: "Físico",
  Special: "Especial",
  Status: "Estado",
};

export function categoryLabel(category: MoveCategory): string {
  return LABEL[category];
}

export function CategoryIcon({ category, className }: { category: MoveCategory; className?: string }) {
  const common = className ?? "size-3.5";
  if (category === "Physical") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden className={common} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 13 L8 3 L13 13" />
        <path d="M5.2 9.5 H10.8" />
      </svg>
    );
  }
  if (category === "Special") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden className={common} fill="currentColor">
        <path d="M8 1.5 9.4 6H14l-3.7 2.8 1.4 4.5L8 10.6 4.3 13.3 5.7 8.8 2 6h4.6L8 1.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={common} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="5.2" />
      <path d="M8 5.2 V8.2 L10 9.6" />
    </svg>
  );
}
