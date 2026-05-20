"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminButton } from "@/components/admin/AdminButton";

interface TurmaFormProps {
  defaultValues?: {
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    location: string;
    whatsappGroupUrl: string;
    status: string;
  };
  action: (data: FormData) => Promise<{ error?: string; fieldError?: { field: string; message: string }; success?: boolean } | void>;
  submitLabel?: string;
}

const INPUT_STYLE = {
  background: "var(--admin-input-bg)",
  border: "1px solid var(--admin-border)",
  color: "var(--admin-fg)",
  borderRadius: "0.5rem",
  padding: "0.625rem 0.875rem",
  width: "100%",
  fontSize: "0.875rem",
} as const;

const LABEL_STYLE = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  marginBottom: "0.375rem",
  color: "var(--admin-muted)",
} as const;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function TurmaForm({ defaultValues, action, submitLabel = "Salvar" }: TurmaFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [slug, setSlug] = useState(defaultValues?.slug ?? "");
  const [pending, startTransition] = useTransition();
  const isEditing = Boolean(defaultValues);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextName = e.target.value;
    setName(nextName);
    if (!isEditing) {
      setSlug(slugify(nextName));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(data);
      if (result?.error) setError(result.error);
      else if (result?.fieldError) setFieldError(result.fieldError);
      else if (result?.success) toast.success("Turma salva com sucesso!");
    });
  }

  function fieldErrorFor(field: string) {
    return fieldError?.field === field ? fieldError.message : null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label htmlFor="name" style={LABEL_STYLE}>Nome *</label>
        <input id="name" name="name" required autoComplete="off" value={name} onChange={handleNameChange} style={INPUT_STYLE} />
        {fieldErrorFor("name") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("name")}</p>}
      </div>

      <div>
        <label htmlFor="slug" style={LABEL_STYLE}>Slug *</label>
        <input
          id="slug"
          name="slug"
          required
          autoComplete="off"
          spellCheck={false}
          readOnly
          aria-readonly="true"
          value={slug}
          style={{ ...INPUT_STYLE, background: "var(--admin-surface-elevated)", color: "var(--admin-muted)", cursor: "not-allowed" }}
          placeholder="Gerado automaticamente pelo nome"
        />
        {fieldErrorFor("slug") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("slug")}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startsAt" style={LABEL_STYLE}>Data de início</label>
          <input id="startsAt" name="startsAt" type="datetime-local" defaultValue={defaultValues?.startsAt} style={INPUT_STYLE} />
        </div>
        <div>
          <label htmlFor="endsAt" style={LABEL_STYLE}>Data de término</label>
          <input id="endsAt" name="endsAt" type="datetime-local" defaultValue={defaultValues?.endsAt} style={INPUT_STYLE} />
          {fieldErrorFor("endsAt") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("endsAt")}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="location" style={LABEL_STYLE}>Local</label>
        <input id="location" name="location" defaultValue={defaultValues?.location} style={INPUT_STYLE} placeholder="ex: São Paulo, SP" />
      </div>

      <div>
        <label htmlFor="whatsappGroupUrl" style={LABEL_STYLE}>Link do grupo WhatsApp</label>
        <input
          id="whatsappGroupUrl"
          name="whatsappGroupUrl"
          type="url"
          defaultValue={defaultValues?.whatsappGroupUrl}
          style={INPUT_STYLE}
          placeholder="https://chat.whatsapp.com/..."
        />
        <p className="text-xs mt-1" style={{ color: "var(--admin-muted)" }}>
          Exibido para o aluno após compra aprovada. Use link de convite do grupo WhatsApp.
        </p>
        {fieldErrorFor("whatsappGroupUrl") && <p className="text-xs mt-1" style={{ color: "var(--admin-danger)" }}>{fieldErrorFor("whatsappGroupUrl")}</p>}
      </div>

      <div>
        <label htmlFor="status" style={LABEL_STYLE}>Status *</label>
        <select id="status" name="status" defaultValue={defaultValues?.status ?? "draft"} style={{ ...INPUT_STYLE, cursor: "pointer" }}>
          <option value="draft">Rascunho</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="archived">Arquivado</option>
        </select>
      </div>

      <p
        role="alert"
        aria-live="polite"
        className="text-sm"
        style={{ color: "var(--admin-danger)", minHeight: "1.25rem" }}
      >
        {error ?? ""}
      </p>

      <div className="flex gap-3 pt-2">
        <AdminButton type="submit" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </AdminButton>
        <AdminButton href="/admin/turmas" variant="secondary">
          Cancelar
        </AdminButton>
      </div>
    </form>
  );
}
