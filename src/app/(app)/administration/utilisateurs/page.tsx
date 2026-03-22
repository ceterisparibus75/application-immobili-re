import { getUsers, getUsersNotInSociety } from "@/actions/user";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, UserPlus, Users } from "lucide-react";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import type { UserRole } from "@prisma/client";
import UsersClient from "./_components/users-client";

export default async function UtilisateursPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const [members, availableUsers] = await Promise.all([
    getUsers(societyId),
    getUsersNotInSociety(societyId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Gestion des accès
          </h1>
          <p className="text-muted-foreground">
            Gérez les utilisateurs et leurs droits sur la société
          </p>
        </div>
      </div>

      {/* Résumé */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Membres actifs</p>
            <p className="text-2xl font-bold">{members.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">
              Utilisateurs disponibles à ajouter
            </p>
            <p className="text-2xl font-bold">{availableUsers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table des membres */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Membres ({members.length})
              </CardTitle>
              <CardDescription>
                Utilisateurs ayant accès à cette société
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun membre pour cette société
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Utilisateur</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Rôle</th>
                    <th className="text-left p-3 font-medium">
                      Dernière connexion
                    </th>
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
                      <td className="p-3 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="p-3">
                        {user.role && (
                          <Badge variant="outline">
                            {ROLE_LABELS[user.role as UserRole]}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {user.lastLoginAt
                          ? formatDateTime(user.lastLoginAt)
                          : "Jamais"}
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

      {/* Ajouter un utilisateur existant */}
      {availableUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Ajouter un utilisateur existant
            </CardTitle>
            <CardDescription>
              Donnez accès à un utilisateur déjà enregistré dans l'application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsersClient
              mode="add-existing"
              societyId={societyId}
              availableUsers={availableUsers}
            />
          </CardContent>
        </Card>
      )}

      {/* Créer un nouvel utilisateur */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Créer un nouvel utilisateur
          </CardTitle>
          <CardDescription>
            Crée un compte et l'assigne directement à cette société
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersClient mode="create" societyId={societyId} />
        </CardContent>
      </Card>
    </div>
  );
}
