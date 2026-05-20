import { requireOperator } from "@/lib/admin/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { WebhookEndpointForm } from "../WebhookEndpointForm";
import { createEndpointAction } from "../actions";

export const metadata = { title: "Novo Webhook — Admin" };

export default async function NewWebhookPage() {
  await requireOperator();

  return (
    <div>
      <AdminPageHeader
        title="Novo Endpoint Webhook"
        action={<AdminButton href="/admin/webhooks" variant="secondary">← Voltar</AdminButton>}
      />
      <WebhookEndpointForm action={createEndpointAction} submitLabel="Criar endpoint" />
    </div>
  );
}
