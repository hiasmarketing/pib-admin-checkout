import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/admin/auth";
import { getTurmaBySlug } from "@/lib/catalog/turmas";
import { listProducts } from "@/lib/catalog/products";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import Link from "next/link";
import { EditTurmaForm } from "./EditTurmaForm";

export async function generateMetadata({ params }: { params: Promise<{ turmaSlug: string }> }) {
  const { turmaSlug } = await params;
  const turma = await getTurmaBySlug(turmaSlug);
  return { title: `${turma?.name ?? "Turma"} — Admin` };
}

export default async function TurmaDetailPage({
  params,
}: {
  params: Promise<{ turmaSlug: string }>;
}) {
  await requireOperator();
  const { turmaSlug } = await params;
  const turma = await getTurmaBySlug(turmaSlug);

  if (!turma) notFound();

  const products = await listProducts(turma.id);

  return (
    <div>
      <AdminPageHeader
        title={turma.name}
        action={
          <AdminButton href="/admin/turmas" variant="secondary">
            ← Turmas
          </AdminButton>
        }
      />

      {/* Edit form */}
      <EditTurmaForm turma={turma} />

      {/* Products section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: "var(--admin-fg)" }}>
            Produtos
          </h2>
          <AdminButton href={`/admin/turmas/${turma.slug}/products/new`}>
            + Novo produto
          </AdminButton>
        </div>

        {products.length === 0 ? (
          <div
            className="text-center py-8 px-4 rounded-xl border"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-muted)" }}
          >
            <p className="text-sm">Nenhum produto nesta turma.</p>
            <p className="text-xs mt-2">
              Para aparecer no checkout, a turma precisa ter pelo menos um produto ativo com preço.
            </p>
            <div className="mt-4">
              <AdminButton href={`/admin/turmas/${turma.slug}/products/new`}>
                Criar produto agora
              </AdminButton>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/admin/turmas/${turma.slug}/products/${product.slug}`}
                className="block"
              >
                <div
                  className="rounded-xl border p-4 hover:border-[var(--admin-brand)]/30 transition-colors"
                  style={{
                    background: "var(--admin-surface)",
                    borderColor: "var(--admin-border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm" style={{ color: "var(--admin-fg)" }}>
                          {product.name}
                        </span>
                        <AdminStatusChip status={product.active ? "active" : "inactive"} />
                        {product.isDefault && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--admin-brand)/10", color: "var(--admin-brand)" }}>
                            Default
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: "var(--admin-muted)" }}>
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(product.unitAmountCents / 100)}{" "}
                        · até {product.maxQuantity} ingresso(s) · parcelas: {product.installmentOptions.join(", ")}x
                      </div>
                    </div>
                    <div className="text-xs flex-shrink-0" style={{ color: "var(--admin-muted)" }}>
                      Editar →
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
