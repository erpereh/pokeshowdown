"use client";

import { ApiRequestError } from "@/client/api";
import { GameLink, Spinner } from "@/client/ui/GameButton";
import { getTeam, errorMessage } from "@/client/team-builder/api";
import { TeamEditor } from "@/client/team-builder/TeamEditor";
import { TeamScreen } from "@/client/team-builder/frame";
import type { TeamRecord, ValidationResult } from "@/shared/contract";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditTeamPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [team, setTeam] = useState<TeamRecord | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setTeam(null);
    setError(null);
    void getTeam(id)
      .then((result) => {
        if (controller.signal.aborted) return;
        setTeam(result.team);
        setValidation(result.validation);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiRequestError && caught.status === 401) {
          router.replace(`/auth?next=${encodeURIComponent(`/teams/${id}`)}`);
          return;
        }
        setError(errorMessage(caught) || "No se ha podido abrir el equipo.");
      });
    return () => controller.abort();
  }, [id, router]);

  if (!team && !error) {
    return (
      <TeamScreen>
        <div className="flex min-h-40 items-center justify-center">
          <Spinner />
        </div>
      </TeamScreen>
    );
  }

  if (!team) {
    return (
      <TeamScreen>
        <h1 className="font-display text-3xl font-bold">Equipo no encontrado</h1>
        <p className="text-sm text-danger">{error}</p>
        <GameLink href="/teams" variant="secondary" size="md">
          Volver a los equipos
        </GameLink>
      </TeamScreen>
    );
  }

  return (
    <TeamScreen>
      <TeamEditor key={team.id} initial={team} initialValidation={validation} />
    </TeamScreen>
  );
}
