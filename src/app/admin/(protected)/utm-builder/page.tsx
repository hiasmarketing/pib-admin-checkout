import { requireOperator } from "@/lib/admin/auth";
import { getLeadUtmPatterns } from "@/lib/admin/leads";
import { getCheckoutOrigin } from "@/lib/public-urls";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { UtmBuilderClient } from "@/components/admin/UtmBuilderClient";

export const metadata = { title: "UTM Builder — Admin" };

export default async function UtmBuilderPage() {
  await requireOperator();

  const patterns = await getLeadUtmPatterns();
  const checkoutOrigin = getCheckoutOrigin();

  return (
    <div>
      <AdminPageHeader
        title="UTM Builder"
        description="Monte URLs com rastreamento para suas campanhas"
      />
      <UtmBuilderClient patterns={patterns} defaultBaseUrl={`${checkoutOrigin}/formulario`} />
    </div>
  );
}
