import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSocieties } from "@/actions/society";
import { SocietyProvider } from "@/providers/society-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const societies = await getSocieties();

  if (societies.length === 0) {
    const { headers: nextHeaders } = await import("next/headers");
    const h = await nextHeaders();
    const pathname = h.get("x-pathname") ?? "";
    const isSetup = pathname.startsWith("/proprietaire/setup") || pathname.startsWith("/societes/nouvelle");
    if (!isSetup) {
      const { redirect } = await import("next/navigation");
      redirect("/proprietaire/setup");
    }
  }

  return (
    <SocietyProvider initialSocieties={societies}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col lg:pl-[260px]">
          <Header />
          <Breadcrumb />
          <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </SocietyProvider>
  );
}
