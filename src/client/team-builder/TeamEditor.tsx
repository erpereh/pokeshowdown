"use client";

import { GameButton, GameLink } from "@/client/ui/GameButton";
import { Modal, useDialog } from "@/client/ui/Modal";
import { pushToast } from "@/client/ui/Toast";
import type { NatureEntry, SpeciesSummary, TeamRecord, ValidationResult } from "@/shared/contract";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  copyText,
  createTeam,
  errorMessage,
  exportTeam,
  fetchNatures,
  fetchSpecies,
  fetchTypes,
  importTeam,
  isAbort,
  randomTeam,
  updateTeam,
  validateTeam,
} from "./api";
import { controlClass, Field, FormatBadge, ValidityBadge } from "./controls";
import { useUnsavedWarning } from "./feedback";
import { useSpeciesCache } from "./hooks";
import {
  createEditorState,
  draftReducer,
  payloadSets,
  problemsForSlot,
  setFromSpecies,
  snapshot,
  TEAM_NAME_MAX,
} from "./model";
import type { TeamDraft, TeamEditorInitial } from "./model";
import { PreviewPanel, TeamProblems } from "./PreviewPanel";
import { SetEditor } from "./SetEditor";
import { SlotRail } from "./SlotRail";

export type { TeamDraft, TeamEditorInitial };

export interface TeamEditorProps {
  /** Saved `TeamRecord`, or an unsaved draft (`id: null`). Later updates are ignored; remount with `key`. */
  initial: TeamEditorInitial;
  initialValidation?: ValidationResult | null;
  /** Fired after a successful POST or PUT, with the server record. */
  onSaved?: (team: TeamRecord) => void;
  /** Shows the link back to `/teams`. Turn it off when the editor is embedded. */
  showTeamsLink?: boolean;
}

export function TeamEditor({ initial, initialValidation = null, onSaved, showTeamsLink = true }: TeamEditorProps) {
  const [state, dispatch] = useReducer(draftReducer, initial, createEditorState);
  const mobile = useIsMobile();
  const sets = payloadSets(state.slots);
  const setsKey = JSON.stringify(sets);
  const dirty = snapshot(state.name, state.slots) !== state.baseline;
  useUnsavedWarning(dirty);

  const speciesNames = state.slots.map((slot) => slot?.species ?? "");
  const species = useSpeciesCache(speciesNames);
  const [natures, setNatures] = useState<NatureEntry[] | null>(null);
  const [types, setTypes] = useState<string[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogNonce, setCatalogNonce] = useState(0);
  const [validation, setValidation] = useState<ValidationResult | null>(initialValidation);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"random" | "import" | "export" | null>(null);
  const [sheet, setSheet] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [exportText, setExportText] = useState<string | null>(null);
  const sheetRef = useDialog(sheet && mobile, () => setSheet(false));
  const validateGen = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pickToken = useRef(0);
  const [picking, setPicking] = useState(false);
  const setsRef = useRef(sets);
  setsRef.current = sets;

  const selectedSet = state.slots[state.selected] ?? null;
  const problems = validation?.problems ?? [];

  const runValidate = useCallback(async (current: typeof sets, signal?: AbortSignal) => {
    const gen = ++validateGen.current;
    setChecking(true);
    setCheckError(null);
    try {
      const result = await validateTeam(current, signal);
      if (gen !== validateGen.current) return;
      setValidation(result);
    } catch (error) {
      if (isAbort(error) || gen !== validateGen.current) return;
      setCheckError(errorMessage(error));
    } finally {
      if (gen === validateGen.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      void runValidate(setsRef.current, controller.signal);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [setsKey, runValidate]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError(null);
    void Promise.all([fetchNatures(controller.signal), fetchTypes(controller.signal)])
      .then(([natureResult, typeResult]) => {
        setNatures(natureResult.natures);
        setTypes(typeResult.types);
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setCatalogError(errorMessage(error));
      });
    return () => controller.abort();
  }, [catalogNonce]);

  useEffect(() => {
    document.title = `${state.name.trim() || "Nuevo equipo"} · Equipos · PokeShowdown`;
  }, [state.name]);

  function selectSlot(index: number) {
    dispatch({ type: "select", index });
    setSheet(true);
  }

  async function save() {
    const name = state.name.trim();
    if (!name) {
      pushToast("El equipo necesita un nombre.");
      return;
    }
    setSaving(true);
    try {
      const result = state.id ? await updateTeam(state.id, name, setsRef.current) : await createTeam(name, setsRef.current);
      dispatch({ type: "saved", team: result.team });
      setValidation(result.validation);
      pushToast(result.validation.valid ? "Equipo guardado y válido." : "Equipo guardado. Sigue teniendo problemas de legalidad.");
      onSaved?.(result.team);
    } catch (error) {
      pushToast(errorMessage(error) || "No se ha podido guardar el equipo.");
    } finally {
      setSaving(false);
    }
  }

  async function generateRandom() {
    if (setsRef.current.length && !window.confirm("Se sustituirá el equipo actual por uno aleatorio de Gen 9 OU. ¿Continuar?")) return;
    setBusy("random");
    try {
      const result = await randomTeam();
      dispatch({ type: "replace", sets: result.sets });
      pushToast("Equipo aleatorio generado. Todavía no está guardado.");
    } catch (error) {
      pushToast(errorMessage(error) || "No se ha podido generar el equipo.");
    } finally {
      setBusy(null);
    }
  }

  async function applyImport() {
    setBusy("import");
    try {
      const result = await importTeam(importText);
      if (!result.sets.length) {
        pushToast("El texto no contiene Pokémon.");
        return;
      }
      if (setsRef.current.length && !window.confirm("Se sustituirán los Pokémon de este equipo. ¿Continuar?")) return;
      dispatch({ type: "replace", sets: result.sets });
      setImportOpen(false);
      setImportText("");
      pushToast("Equipo importado en el editor. Todavía no está guardado.");
    } catch (error) {
      pushToast(errorMessage(error) || "No se ha podido importar el equipo.");
    } finally {
      setBusy(null);
    }
  }

  async function openExport() {
    if (!setsRef.current.length) {
      pushToast("No hay Pokémon para exportar.");
      return;
    }
    setBusy("export");
    try {
      const result = await exportTeam(setsRef.current);
      setExportText(result.text);
    } catch (error) {
      pushToast(errorMessage(error) || "No se ha podido exportar el equipo.");
    } finally {
      setBusy(null);
    }
  }

  async function pickSpecies(summary: SpeciesSummary) {
    const current = state.slots[state.selected] ?? null;
    if (current?.species === summary.name) return;
    if (current && current.moves.length > 0) {
      const ok = window.confirm(`¿Cambiar ${current.species} por ${summary.name}? Se quitarán los movimientos de esta ranura.`);
      if (!ok) return;
    }
    const token = ++pickToken.current;
    setPicking(true);
    try {
      const bundle = await fetchSpecies(summary.id);
      if (token !== pickToken.current) return;
      species.remember(bundle);
      dispatch({ type: "place", index: state.selected, set: setFromSpecies(bundle.species, current) });
    } catch (error) {
      if (token !== pickToken.current || isAbort(error)) return;
      pushToast(errorMessage(error) || "No se ha podido cargar la especie.");
    } finally {
      if (token === pickToken.current) setPicking(false);
    }
  }

  const editorClass = sheet
    ? "fixed inset-0 z-50 block overflow-y-auto overscroll-contain bg-bg-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:z-auto md:overflow-visible md:bg-transparent md:p-0"
    : "hidden md:block";

  const bundle = selectedSet ? species.get(selectedSet.species) : null;

  return (
    <div data-testid="team-editor" className="flex min-w-0 flex-col gap-4">
      <header className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {showTeamsLink ? (
            <GameLink href="/teams" variant="ghost" size="md">
              Equipos
            </GameLink>
          ) : null}
          <FormatBadge />
          <ValidityBadge valid={validation ? validation.valid : null} />
          <p className="text-sm text-text-dim" aria-live="polite">
            {saving ? "Guardando…" : dirty ? "Cambios sin guardar" : state.id ? "Guardado" : "Equipo nuevo"}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="min-w-0 w-full">
            <h1 className="font-display text-3xl font-bold">Editor de equipo</h1>
            <div className="mt-3 w-full max-w-xl">
              <Field label="Nombre del equipo" htmlFor="team-name" hint={state.name.trim() ? `${state.name.trim().length}/${TEAM_NAME_MAX}` : "El equipo necesita un nombre para guardarse."}>
                <input
                  id="team-name"
                  className={controlClass}
                  maxLength={TEAM_NAME_MAX}
                  value={state.name}
                  placeholder="Mi equipo OU"
                  onChange={(event) => dispatch({ type: "rename", name: event.target.value })}
                />
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <GameButton type="button" size="md" loading={saving} disabled={!state.name.trim()} onClick={() => void save()} data-testid="save-team">
              Guardar
            </GameButton>
            <GameButton type="button" variant="secondary" size="md" loading={checking} onClick={() => void runValidate(setsRef.current)}>
              Validar
            </GameButton>
            <GameButton type="button" variant="secondary" size="md" className="col-span-2 sm:col-span-1" loading={busy === "random"} onClick={() => void generateRandom()}>
              Generar equipo aleatorio OU
            </GameButton>
            <GameButton type="button" variant="secondary" size="md" onClick={() => setImportOpen(true)}>
              Importar
            </GameButton>
            <GameButton type="button" variant="secondary" size="md" loading={busy === "export"} onClick={() => void openExport()}>
              Exportar
            </GameButton>
          </div>
        </div>
      </header>

      <div className={sheet ? "hidden" : "block md:hidden"}>
        <TeamProblems problems={problems} checking={checking} error={checkError} hasSets={sets.length > 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
        <div className="min-w-0 md:sticky md:top-20 md:self-start">
          <SlotRail slots={state.slots} selected={state.selected} problems={problems} bundleFor={species.get} onSelect={selectSlot} />
        </div>
        <div
          ref={sheetRef}
          className={editorClass}
          role={sheet && mobile ? "dialog" : undefined}
          aria-modal={sheet && mobile ? true : undefined}
          aria-labelledby={sheet && mobile ? "slot-editor-title" : undefined}
          tabIndex={sheet && mobile ? -1 : undefined}
        >
          <GameButton type="button" variant="secondary" size="md" className="mb-3 md:hidden" data-sheet-back onClick={() => setSheet(false)}>
            Volver a las ranuras
          </GameButton>
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="lg:hidden">
                <TeamProblems problems={problems} checking={checking} error={checkError} hasSets={sets.length > 0} />
              </div>
              <SetEditor
                index={state.selected}
                set={selectedSet}
                bundle={bundle}
                bundleStatus={selectedSet ? species.statusFor(selectedSet.species) : "idle"}
                problems={problemsForSlot(problems, state.slots, state.selected)}
                natures={natures}
                types={types}
                catalogError={catalogError}
                hasEmptySlot={state.slots.some((slot) => slot === null)}
                picking={picking}
                onPickSpecies={(summary) => void pickSpecies(summary)}
                onRetrySpecies={() => {
                  if (selectedSet) species.retry(selectedSet.species);
                }}
                onRetryCatalog={() => setCatalogNonce((value) => value + 1)}
                onNotice={pushToast}
                dispatch={dispatch}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <PreviewPanel set={selectedSet} bundle={bundle} natures={natures} />
              <div className="hidden lg:block">
                <TeamProblems problems={problems} checking={checking} error={checkError} hasSets={sets.length > 0} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={importOpen} title="Importar en este equipo" onClose={() => setImportOpen(false)}>
        <Field label="Texto de Showdown" htmlFor="editor-import-text">
          <textarea
            id="editor-import-text"
            data-autofocus
            className={`${controlClass} min-h-48 py-3 font-mono text-sm`}
            value={importText}
            placeholder="Pega aquí un equipo exportado de Pokémon Showdown"
            onChange={(event) => setImportText(event.target.value)}
          />
        </Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <GameButton type="button" size="md" loading={busy === "import"} onClick={() => void applyImport()}>
            Sustituir equipo
          </GameButton>
          <GameButton type="button" variant="ghost" size="md" onClick={() => setImportOpen(false)}>
            Cancelar
          </GameButton>
        </div>
      </Modal>

      <Modal open={exportText !== null} title="Exportar a Showdown" onClose={() => setExportText(null)}>
        <Field label="Texto del equipo" htmlFor="editor-export-text">
          <textarea id="editor-export-text" data-autofocus readOnly className={`${controlClass} min-h-48 py-3 font-mono text-sm`} value={exportText ?? ""} />
        </Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <GameButton
            type="button"
            size="md"
            onClick={() => {
              if (!exportText) return;
              void copyText(exportText).then((ok) =>
                pushToast(ok ? "Texto de Showdown copiado." : "No se ha podido copiar. Selecciona el texto a mano."),
              );
            }}
          >
            Copiar
          </GameButton>
          <GameButton type="button" variant="ghost" size="md" onClick={() => setExportText(null)}>
            Cerrar
          </GameButton>
        </div>
      </Modal>
    </div>
  );
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}
