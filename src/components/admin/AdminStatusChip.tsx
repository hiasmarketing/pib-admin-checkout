interface AdminStatusChipProps {
  status:
    | "active"
    | "inactive"
    | "draft"
    | "archived"
    | "paid"
    | "pending"
    | "failed"
    | "delivered"
    | "processing"
    | "dead"
    | "abandoned"
    | "expired";
  label?: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  delivered: "bg-green-500/10 text-green-400 border-green-500/20",
  inactive: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  archived: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  dead: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  draft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  abandoned: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  expired: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  draft: "Rascunho",
  archived: "Arquivado",
  paid: "Pago",
  pending: "Pendente",
  failed: "Falhou",
  delivered: "Entregue",
  processing: "Processando",
  dead: "Morto",
  abandoned: "Abandonado",
  expired: "Expirado",
};

export function AdminStatusChip({ status, label }: AdminStatusChipProps) {
  const style = STATUS_STYLES[status] ?? "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
  const text = label ?? STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}
    >
      {text}
    </span>
  );
}
