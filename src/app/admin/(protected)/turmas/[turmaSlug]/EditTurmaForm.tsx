"use client";

import { TurmaForm } from "../TurmaForm";
import { updateTurmaAction } from "../actions";
import type { TurmaDTO } from "@/lib/catalog/types";
import { formatSaoPauloDateTimeLocalInput } from "@/lib/timezone";

export function EditTurmaForm({ turma }: { turma: TurmaDTO }) {
  const action = updateTurmaAction.bind(null, turma.id);

  const defaultValues = {
    name: turma.name,
    slug: turma.slug,
    startsAt: turma.startsAt
      ? formatSaoPauloDateTimeLocalInput(turma.startsAt)
      : "",
    endsAt: turma.endsAt
      ? formatSaoPauloDateTimeLocalInput(turma.endsAt)
      : "",
    location: turma.location ?? "",
    whatsappGroupUrl: turma.whatsappGroupUrl ?? "",
    status: turma.status,
  };

  return (
    <TurmaForm
      defaultValues={defaultValues}
      action={action}
      submitLabel="Salvar alterações"
    />
  );
}
