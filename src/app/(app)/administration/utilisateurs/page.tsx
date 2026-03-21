"use client";

import { useEffect, useState } from "react";
import { useSociety } from "@/providers/society-provider";
import { getUsers, createUser, assignUserToSociety, deleteUser } from "@/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { USER_ROLES } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  Plus,
  Loader2,
  UserPlus,
  Shield,
  Trash2,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  role?: string;
}

export default function UtilisateursPage() {
  const { activeSociety } = useSociety();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadUsers();
  }, [activeSociety]);

  async function loadUsers() {
    setIsLoading(true);
    try {
      const data = await getUsers(activeSociety?.id);
      setUsers(data as UserListItem[]);
    } catch {
      setError("Erreur lors du chargement des utilisateurs");
    }
    setIsLoading(false);
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createUser({
      email: data.email,
      name: data.name,
      firstName: data.firstName,
      password: data.password,
    });

    if (result.success && result.data && activeSociety) {
      // Assigner à la société active
      await assignUserToSociety({
        userId: result.data.id,
        societyId: activeSociety.id,
        role: data.role as "SUPER_ADMIN" | "ADMIN_SOCIETE" | "GESTIONNAIRE" | "COMPTABLE" | "LECTURE",
      });
      setSuccess("Utilisateur créé et assigné avec succès");
      setShowCreateForm(false);
      loadUsers();
    } else {
      setError(result.error ?? "Erreur lors de la création");
    }

    setCreating(false);
  }

  async function handleDeleteUser(userId: string, userEmail: string) {
    if (!confirm(`Supprimer définitivement l'utilisateur ${userEmail} ? Cette action est irréversible.`)) return;
    setDeletingId(userId);
    setError("");
    const result = await deleteUser(userId);
    if (result.success) {
      setSuccess("Utilisateur supprimé");
      loadUsers();
    } else {
      setError(result.error ?? "Erreur lors de la suppression");
    }
    setDeletingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground">
            {activeSociety
              ? `Utilisateurs de ${activeSociety.name}`
              : "Tous les utilisateurs"}
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-100 dark:bg-green-900/30 p-3 text-sm text-green-800 dark:text-green-200">
          {success}
        </div>
      )}

      {/* Formulaire de création */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Créer un utilisateur
            </CardTitle>
            <CardDescription>
              L'utilisateur sera automatiquement assigné à la société active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom *</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input id="firstName" name="firstName" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle *</Label>
                  <Select
                    id="role"
                    name="role"
                    options={USER_ROLES.filter(
                      (r) => r.value !== "SUPER_ADMIN"
                    ).map((r) => ({ value: r.value, label: r.label }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2 max-w-md">
                <Label htmlFor="password">Mot de passe *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre
                </p>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Créer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Liste des utilisateurs */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Shield className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun utilisateur trouvé
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Nom</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Rôle</th>
                    <th className="text-left p-3 font-medium">Statut</th>
                    <th className="text-left p-3 font-medium">
                      Dernière connexion
                    </th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
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
                      <td className="p-3">
                        <Badge
                          variant={user.isActive ? "success" : "secondary"}
                        >
                          {user.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {user.lastLoginAt
                          ? formatDateTime(user.lastLoginAt)
                          : "Jamais"}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          disabled={deletingId === user.id}
                        >
                          {deletingId === user.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
