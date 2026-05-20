import { requireOperator } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const operator = await requireOperator();
  const shellOperator = {
    name: operator.name,
    email: operator.email,
    role: operator.role,
  };

  return (
    <div className="admin-root min-h-screen">
      <div className="hidden md:block">
        <AdminSidebar operator={shellOperator} />
      </div>

      <AdminMobileNav operator={shellOperator} />

      <main className="md:pl-60 pt-16 md:pt-0">
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-12 md:pt-12 md:pb-16 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
