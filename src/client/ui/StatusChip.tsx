import type { StatusId } from "@/shared/contract";
import { cx } from "./cx.ts";

const LABEL: Record<StatusId, string> = {
  brn: "Quemado",
  par: "Paralizado",
  psn: "Envenenado",
  tox: "Intoxicado",
  slp: "Dormido",
  frz: "Congelado",
};

const SHORT: Record<StatusId, string> = {
  brn: "QUE",
  par: "PAR",
  psn: "ENV",
  tox: "TOX",
  slp: "DOR",
  frz: "CON",
};

const TONE: Record<StatusId, string> = {
  brn: "bg-status-brn text-[#1f2630]",
  par: "bg-status-par text-[#1f2630]",
  psn: "bg-status-psn text-white",
  tox: "bg-status-tox text-white",
  slp: "bg-status-slp text-[#1f2630]",
  frz: "bg-status-frz text-[#1f2630]",
};

export function StatusChip({ status, className }: { status: StatusId; className?: string }) {
  return (
    <span
      title={LABEL[status]}
      aria-label={LABEL[status]}
      className={cx(
        "font-display inline-flex min-h-5 items-center rounded px-1.5 text-[10px] font-bold uppercase tracking-wide",
        TONE[status],
        className,
      )}
    >
      {SHORT[status]}
    </span>
  );
}
