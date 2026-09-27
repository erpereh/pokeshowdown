"use client";

import { ApiRequestError } from "@/client/api";
import { GameButton, GameLink, Spinner } from "@/client/ui/GameButton";
import { GlassPanel } from "@/client/ui/GlassPanel";
import { EmptyState } from "@/client/ui/EmptyState";
import { ErrorState } from "@/client/ui/ErrorState";
import { Modal } from "@/client/ui/Modal";
import { PageHeader } from "@/client/ui/PageHeader";
import { pushToast } from "@/client/ui/Toast";
import type { TeamSummary } from "@/shared/contract";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { copyText, deleteTeam, duplicateTeam, errorMessage, exportTeam, getTeam, importTeam, listTeams } from "./api";
import { controlClass, EmptySlotMark, Field, FormatBadge, ValidityBadge } from "./controls";
import { TeamScreen } from "./frame";
import { MiniSprite } from "./media";
import { formatUpdated, IMPORTED_SETS_KEY } from "./model";

export function TeamListPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; action: "duplicate" | "delete" | "export" } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [exportFallback, setExportFallback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await listTeams();
      setTeams(result.teams);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        router.replace("/auth?next=%2Fteams");
        return;
      }
      setError(errorMessage(caught) || "No se han podido cargar tus equipos.");
      setTeams([]);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingDelete = teams?.find((team) => team.id === confirmId) ?? null;

  async function duplicate(id: string) {
    setPending({ id, action: "duplicate" });
    try {
      const result = await duplicateTeam(id);
      pushToast(`Equipo duplicado: ${result.team.name}`);
      await load();
    } catch (caught) {
      pushToast(errorMessage(caught) || "No se ha podido duplicar el equipo.");
    } finally {
      setPending(null);
    }
  }

  async function remove(id: string) {
    setPending({ id, action: "delete" });
    try {
      await deleteTeam(id);
      setConfirmId(null);
      pushToast("Equipo eliminado.");
      await load();
    } catch (caught) {
      pushToast(errorMessage(caught) || "No se ha podido eliminar el equipo.");
    } finally {
      setPending(null);
    }
  }

  async function exportOne(id: string) {
    setPending({ id, action: "export" });
    try {
      const loaded = await getTeam(id);
      const result = await exportTeam(loaded.team.sets);
      const copied = await copyText(result.text);
      if (copied) pushToast("Texto de Showdown copiado.");
      else setExportFallback(result.text);
    } catch (caught) {
      pushToast(errorMessage(caught) || "No se ha podido exportar el equipo.");
    } finally {
      setPending(null);
    }
  }

  async function startImport() {
    setImporting(true);
    try {
      const result = await importTeam(importText);
      if (!result.sets.length) {
        pushToast("El texto no contiene Pokémon.");
        return;
      }
      sessionStorage.setItem(IMPORTED_SETS_KEY, JSON.stringify(result.sets));
      setImportOpen(false);
      setImportText("");
      router.push("/teams/new");
    } catch (caught) {
      pushToast(errorMessage(caught) || "No se ha podido importar el equipo.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <TeamScreen>
      <PageHeader
        eyebrow="Constructor"
        title="Tus equipos"
        subtitle="Construye equipos de Gen 9 OU. La legalidad la decide Pokémon Showdown."
        action={
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <GameLink href="/teams/new" size="md" className="w-full sm:w-auto">
              Nuevo equipo
            </GameLink>
            <GameButton type="button" variant="secondary" size="md" onClick={() => setImportOpen(true)}>
              Importar
            </GameButton>
          </div>
        }
      />

      {teams === null && !error ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : null}

      {error ? <ErrorState title="No se han podido cargar tus equipos" body={error} onRetry={() => void load()} /> : null}

      {teams && teams.length === 0 && !error ? (
        <EmptyState
          title="Aún no tienes equipos"
          body="Crea uno nuevo o importa un equipo exportado de Pokémon Showdown."
          action={
            <GameLink href="/teams/new" size="md">
              Nuevo equipo
            </GameLink>
          }
        />
      ) : null}

      {teams && teams.length > 0 ? (
        <ul data-testid="team-list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <li key={team.id}>
              <TeamCard
                team={team}
                pending={pending?.id === team.id ? pending.action : null}
                onDuplicate={() => void duplicate(team.id)}
                onDelete={() => setConfirmId(team.id)}
                onExport={() => void exportOne(team.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <Modal open={importOpen} title="Importar equipo" onClose={() => setImportOpen(false)}>
        <Field label="Texto de Showdown" htmlFor="list-import-text">
          <textarea
            id="list-import-text"
            data-autofocus
            className={`${controlClass} min-h-48 py-3 font-mono text-sm`}
            value={importText}
            placeholder="Pega aquí un equipo exportado de Pokémon Showdown"
            onChange={(event) => setImportText(event.target.value)}
          />
        </Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <GameButton type="button" size="md" loading={importing} onClick={() => void startImport()}>
            Importar y editar
          </GameButton>
          <GameButton type="button" variant="ghost" size="md" onClick={() => setImportOpen(false)}>
            Cancelar
          </GameButton>
        </div>
      </Modal>

      <Modal open={pendingDelete !== null} title="Eliminar equipo" onClose={() => setConfirmId(null)}>
        <p id="delete-team-copy">
          Se borrará «{pendingDelete?.name || "este equipo"}». Esta acción no se puede deshacer.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <GameButton type="button" variant="secondary" size="md" data-autofocus onClick={() => setConfirmId(null)}>
            Cancelar
          </GameButton>
          <GameButton
            type="button"
            variant="danger"
            size="md"
            loading={pending?.action === "delete"}
            onClick={() => {
              if (confirmId) void remove(confirmId);
            }}
          >
            Eliminar
          </GameButton>
        </div>
      </Modal>

      <Modal open={exportFallback !== null} title="Exportar a Showdown" onClose={() => setExportFallback(null)}>
        <p className="mb-3 text-sm text-text-dim">No se ha podido copiar automáticamente. Selecciona el texto y cópialo a mano.</p>
        <Field label="Texto del equipo" htmlFor="list-export-text">
          <textarea id="list-export-text" readOnly className={`${controlClass} min-h-48 py-3 font-mono text-sm`} value={exportFallback ?? ""} />
        </Field>
        <div className="mt-4">
          <GameButton
            type="button"
            size="md"
            onClick={() => {
              if (!exportFallback) return;
              void copyText(exportFallback).then((ok) => {
                if (ok) {
                  pushToast("Texto de Showdown copiado.");
                  setExportFallback(null);
                }
              });
            }}
          >
            Copiar
          </GameButton>
        </div>
      </Modal>
    </TeamScreen>
  );
}

function TeamCard({
  team,
  pending,
  onDuplicate,
  onDelete,
  onExport,
}: {
  team: TeamSummary;
  pending: "duplicate" | "delete" | "export" | null;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const slots = Array.from({ length: 6 }, (_, index) => ({
    spriteId: team.spriteIds[index] ?? "",
    species: team.species[index] ?? "",
  }));

  return (
    <GlassPanel as="article" data-testid="team-card" className="flex h-full flex-col gap-3 p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h2 className="min-w-0 truncate font-display text-xl font-semibold">{team.name}</h2>
        <ValidityBadge valid={team.valid} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FormatBadge />
        <p className="text-xs text-text-dim">Actualizado {formatUpdated(team.updatedAt)}</p>
      </div>
      <ul className="grid grid-cols-6 gap-0.5" aria-label={`Pokémon de ${team.name}`}>
        {slots.map((slot, index) => (
          <li key={index} className="flex justify-center">
            {slot.spriteId ? (
              <MiniSprite spriteId={slot.spriteId} alt={slot.species || "Pokémon"} size={48} />
            ) : (
              <EmptySlotMark size={48} />
            )}
          </li>
        ))}
      </ul>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <GameLink href={`/teams/${team.id}`} variant="secondary" size="md" className="w-full">
          Editar
        </GameLink>
        <GameButton type="button" variant="secondary" size="md" loading={pending === "duplicate"} onClick={onDuplicate}>
          Duplicar
        </GameButton>
        <GameButton type="button" variant="danger" size="md" onClick={onDelete}>
          Eliminar
        </GameButton>
        <GameButton type="button" variant="ghost" size="md" loading={pending === "export"} onClick={onExport}>
          Exportar
        </GameButton>
      </div>
    </GlassPanel>
  );
}
