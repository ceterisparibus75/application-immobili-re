import { getUsers } from "@/actions/user";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserPlus, Users, AlertTriangle, ArrowUpRight, ShieldAlert } from "lucide-react";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";
import type { PlanId } from "@/lib/stripe";
import UsersClient from "@/app/(app)/administration/utilisateurs/_components/users-client";
import Link from "next/link";
import { ForbiddenError } from "@/lib/permissions";

export const metadata = { title: "Utilisateurs" };

export default async function CompteUtilisateursPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  let members: Awaited<ReturnType<typeof getUsers>>;
  try {
    members = await getUsers(societyId);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Accès restreint</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Vous devez avoir le rôle Administrateur Société ou supérieur pour gérer les utilisateurs.
          </p>
        </div>
      );
    }
    throw error;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { societyId },
    select: { planId: true, status: true },
  });

  const planId = (subscription?.planId ?? "STARTER") as PlanId;
  const plan = PLANS[planId];
  const maxUsers = plan.maxUsers;
  const currentCount = members.length;
  const isAtLimit = maxUsers !== -1 && currentCount >= maxUsers;
  const isOverLimit = maxUsers !== -1 && currentCount > maxUsers;
  const usagePercent = maxUsers === -1 ? 0 : Math.min(100, Math.round((currentCount / maxUsers) * 100));

  return (
    <div className="space-y-6">
      {/* Plan & usage */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Membres actifs</p>
            <p className="text-2xl font-bold">{currentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Limite plan {plan.name}</p>
            <p className="text-2xl font-bold">
              {maxUsers === -1 ? "Illimité" : maxUsers}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Utilisation</p>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isOverLimit ? "bg-destructive" : isAtLimit ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: maxUsers === -1 ? "10%" : `${usagePercent}%` }}
                />
              </div>
              <span className="text-sm font-medium">
                {maxUsers === -1 ? "∞" : `${currentCount}/${maxUsers}`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerte limite */}
      {isAtLimit && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-800">
                  {isOverLimit
                    ? `Limite dépassée : ${currentCount} utilisateurs pour ${maxUsers} autorisés`
                    : `Limite atteinte : ${currentCount}/${maxUsers} utilisateurs`}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Passez au plan supérieur pour ajouter plus d&apos;utilisateurs.
                </p>
              </div>
              <Link href="/compte/abonnement">
                <button className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shrink-0">
                  Changer de plan <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table des membres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Membres ({members.length})
          </CardTitle>
          <CardDescription>
            Utilisateurs ayant accès à cette société
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Aucun membre</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Utilisateur</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Rôle</th>
                    <th className="text-left p-3 font-medium">Dernière connexion</th>
                    <th className="p-3 w-28" />
                  </tr>
                </thead>
                <tbody>
                  {(members as Array<{
                    id: string;
                    email: string;
                    name: string | null;
                    firstName: string | null;
                    isActive: boolean;
                    lastLoginAt: Date | null;
                    createdAt: Date;
                    role?: string;
                  }>).map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <span className="font-medium">
                          {user.name}
                          {user.firstName ? ` ${user.firstName}` : ""}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{user.email}</td>
                      <td className="p-3">
                        {user.role && (
                          <Badge variant="outline">
                            {ROLE_LABELS[user.role as UserRole]}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Jamais"}
                      </td>
                      <td className="p-3 text-right">
                        <UsersClient
                          mode="manage"
                          societyId={societyId}
                          userId={user.id}
                          currentRole={(user.role as UserRole) ?? "LECTURE"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Créer un nouvel utilisateur */}
      {!isAtLimit ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5" />
              Créer un nouvel utilisateur
            </CardTitle>
            <CardDescription>
              Crée un compte et l&apos;assigne directement à cette société
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsersClient mode="create" societyId={societyId} />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <UserPlus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">
              Limite de {maxUsers} utilisateur{maxUsers > 1 ? "s" : ""} atteinte
            </p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Votre plan {plan.name} permet {maxUsers} utilisateur{maxUsers > 1 ? "s" : ""}.
            </p>
            <Link href="/compte/abonnement">
              <button className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
                Passer au plan supérieur <ArrowUpRight className="h-4 w-4" />
              </button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
