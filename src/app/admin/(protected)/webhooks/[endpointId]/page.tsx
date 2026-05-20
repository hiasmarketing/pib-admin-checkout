import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { getWebhookEndpoint } from "@/lib/webhooks/outbound";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { WebhookEndpointForm } from "../WebhookEndpointForm";
import { updateEndpointAction } from "../actions";

export const metadata = { title: "Editar Webhook — Admin" };

export default async function EditWebhookPage({ params }: { params: Promise<{ endpointId: string }> }) {
  await requireOperator();
  const { endpointId } = await params;
  const endpoint = await getWebhookEndpoint(endpointId);

  if (!endpoint) notFound();

  const action = updateEndpointAction.bind(null, endpointId);

  return (
    <div>
      <AdminPageHeader
        title={`Editar: ${endpoint.name}`}
        action={<AdminButton href="/admin/webhooks" variant="secondary">← Voltar</AdminButton>}
      />
      <WebhookEndpointForm
        defaultValues={{ ...endpoint, secretPlaceholder: endpoint.hasSecret }}
        action={action}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
