"use client";

import { Spinner } from "@/client/ui/GameButton";
import { TeamEditor } from "@/client/team-builder/TeamEditor";
import { TeamScreen } from "@/client/team-builder/frame";
import { emptyDraft, readImportedSets } from "@/client/team-builder/model";
import type { TeamDraft } from "@/client/team-builder/model";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewTeamPage() {
  const router = useRouter();
  const [initial, setInitial] = useState<TeamDraft | null>(null);

  useEffect(() => {
    const imported = readImportedSets();
    setInitial(imported && imported.length > 0 ? emptyDraft(imported, "Equipo importado") : emptyDraft());
  }, []);

  if (!initial) {
    return (
      <TeamScreen>
        <div className="flex min-h-40 items-center justify-center">
          <Spinner />
        </div>
      </TeamScreen>
    );
  }

  return (
    <TeamScreen>
      <TeamEditor
        initial={initial}
        onSaved={(team) => {
          router.replace(`/teams/${team.id}`);
        }}
      />
    </TeamScreen>
  );
}
