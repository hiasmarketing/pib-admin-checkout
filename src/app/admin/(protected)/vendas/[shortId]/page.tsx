import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { getOrderByShortId } from "@/lib/admin/orders";
import { getPagarmeFailureReason } from "@/lib/payments/failures";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import { formatSaoPauloDateTime } from "@/lib/timezone";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return formatSaoPauloDateTime(iso);
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "Cartão",
  credit_card: "Cartão",
  pix: "Pix",
};

function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "—";
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>
        {label}
      </div>
      <div className="text-sm" style={{ color: value ? "var(--admin-fg)" : "var(--admin-muted)" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

const STATUS_CHIP_MAP: Record<string, "paid" | "pending" | "failed" | "inactive"> = {
  paid: "paid",
  pending_payment: "pending",
  payment_failed: "failed",
  canceled: "inactive",
};

export default async function VendaDetailPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  await requireOperator();

  const { shortId } = await params;
  const order = await getOrderByShortId(shortId);
  if (!order) notFound();

  const lead = order.lead;
  const failureReason =
    order.status === "payment_failed"
      ? getPagarmeFailureReason({
          pagarmeDeclineCode: order.pagarme_decline_code,
          pagarmeFailureMessage: order.pagarme_failure_message,
        })
      : null;

  return (
    <div>
      <div className="mb-4">
        <AdminButton href="/admin/vendas" variant="secondary">
          ← Vendas
        </AdminButton>
      </div>

      <AdminPageHeader title="Detalhe da venda" />

      {/* Header 3-blocos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <AdminCard>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--admin-muted)" }}>Cliente</div>
          <div className="font-medium text-sm" style={{ color: "var(--admin-fg)" }}>{lead?.name ?? "—"}</div>
          <div className="text-xs mt-1" style={{ color: "var(--admin-muted)" }}>{lead?.email ?? "—"}</div>
          <div className="text-xs" style={{ color: "var(--admin-muted)" }}>{lead?.phone ?? "—"}</div>
          {order.cpf_cnpj && (
            <div className="text-xs mt-1" style={{ color: "var(--admin-muted)" }}>CPF: {order.cpf_cnpj}</div>
          )}
        </AdminCard>

        <AdminCard>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--admin-muted)" }}>Pedido</div>
          <div className="mb-1"><AdminStatusChip status={STATUS_CHIP_MAP[order.status] ?? "inactive"} /></div>
          <div className="text-sm mt-2" style={{ color: "var(--admin-fg)" }}>{order.product_name ?? "—"}</div>
          {order.turma_name && (
            <div className="text-xs" style={{ color: "var(--admin-muted)" }}>{order.turma_name}</div>
          )}
        </AdminCard>

        <AdminCard>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--admin-muted)" }}>Pagamento</div>
          <div className="text-2xl font-bold" style={{ color: "var(--admin-fg)", fontFamily: "var(--font-sora)" }}>
            {formatAmount(order.total_amount_cents, order.currency)}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--admin-muted)" }}>
            {order.paid_at ? formatDate(order.paid_at) : "Não pago"}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--admin-muted)" }}>
            {formatPaymentMethod(order.payment_method)}
          </div>
          {order.status === "payment_failed" && (
            <div className="text-xs mt-2" style={{ color: "var(--admin-danger)" }}>
              Falhou: {failureReason}
            </div>
          )}
        </AdminCard>
      </div>

      {/* Informações em 3 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <AdminCard>
          <div className="text-sm font-medium mb-4" style={{ color: "var(--admin-fg)" }}>Detalhes</div>
          <div className="space-y-3">
            <InfoField label="Data da venda" value={formatDate(order.created_at)} />
            <InfoField label="Qtd de ingressos" value={String(order.quantity)} />
            <InfoField label="Método de pagamento" value={formatPaymentMethod(order.payment_method)} />
            <InfoField label="Parcelas" value={order.installment_count === 1 ? "À vista" : `${order.installment_count}x`} />
            <InfoField label="Cupom" value={order.coupon_code_snapshot} />
          </div>
        </AdminCard>

        <AdminCard>
          <div className="text-sm font-medium mb-4" style={{ color: "var(--admin-fg)" }}>Evento</div>
          <div className="space-y-3">
            <InfoField label="Turma" value={order.turma_name} />
            <InfoField label="Produto" value={order.product_name} />
            <InfoField label="Vendedor" value={order.seller_name_snapshot} />
          </div>
        </AdminCard>

        <AdminCard>
          <div className="text-sm font-medium mb-4" style={{ color: "var(--admin-fg)" }}>Origem</div>
          <div className="space-y-3">
            <InfoField label="Canal" value={lead?.utm_source} />
            <InfoField label="Fonte" value={lead?.utm_medium} />
            <InfoField label="Campanha" value={lead?.utm_campaign} />
          </div>
        </AdminCard>
      </div>

      {order.status === "payment_failed" && (
        <AdminCard className="mb-4">
          <div className="text-sm font-medium mb-4" style={{ color: "var(--admin-fg)" }}>
            Falha Pagar.me
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoField label="Motivo" value={failureReason} />
            <InfoField label="pagarme_decline_code" value={order.pagarme_decline_code} />
            <InfoField label="pagarme_failure_message" value={order.pagarme_failure_message} />
          </div>
        </AdminCard>
      )}

      {/* UTMs do lead */}
      <AdminCard>
        <div className="text-sm font-medium mb-4" style={{ color: "var(--admin-fg)" }}>UTMs do lead</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoField label="Source" value={lead?.utm_source} />
          <InfoField label="Medium" value={lead?.utm_medium} />
          <InfoField label="Campaign" value={lead?.utm_campaign} />
          <InfoField label="Content" value={lead?.utm_content} />
          <InfoField label="Term" value={lead?.utm_term} />
        </div>
      </AdminCard>
    </div>
  );
}
