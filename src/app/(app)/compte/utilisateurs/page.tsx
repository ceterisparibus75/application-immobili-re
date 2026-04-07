import { auth } from "@/lib/auth";
import { getAllManagedUsers } from "@/actions/user";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { UserManagementClient } from "./_components/user-management-client";

export const metadata = { title: "Utilisateurs" };

export default async function CompteUtilisateursPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const result = await getAllManagedUsers();

  if (!result.success || !result.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">Erreur</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {result.error ?? "Impossible de charger les utilisateurs"}
        </p>
      </div>
    );
  }

  return (
    <UserManagementClient
      users={result.data.users}
      societies={result.data.societies}
      currentUserId={session.user.id}
    />
  );
}
