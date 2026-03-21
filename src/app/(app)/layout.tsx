import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSocieties } from "@/actions/society";
import { SocietyProvider } from "@/providers/society-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

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

  return (
    <SocietyProvider initialSocieties={societies}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col lg:pl-64">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </SocietyProvider>
  );
}
