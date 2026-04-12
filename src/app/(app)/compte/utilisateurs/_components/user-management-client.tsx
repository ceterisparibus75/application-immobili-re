"use client";

import { useState, useTransition } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Users, UserPlus, ChevronDown, ChevronRight, Plus, Trash2,
  Loader2, Building2, Mail, Send, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  createUser, assignUserToSociety, removeUserFromSociety,
  resendInvitation,
} from "@/actions/user";
import type { ManagedUser, AvailableSociety } from "@/actions/user";
import { EmailCopyToggle } from "./email-copy-toggle";

const ROLE_OPTIONS = [
  { value: "ADMIN_SOCIETE", label: "Administrateur" },
  { value: "GESTIONNAIRE", label: "Gestionnaire" },
  { value: "COMPTABLE", label: "Comptable" },
  { value: "LECTURE", label: "Lecture seule" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_SOCIETE: "Admin",
  GESTIONNAIRE: "Gestionnaire",
  COMPTABLE: "Comptable",
  LECTURE: "Lecture",
};

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  SUPER_ADMIN: "default",
  ADMIN_SOCIETE: "default",
  GESTIONNAIRE: "secondary",
  COMPTABLE: "outline",
  LECTURE: "outline",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

// ── Props ───────────────────────────────────────────────────────────────────

type Props = {
  users: ManagedUser[];
  societies: AvailableSociety[];
  currentUserId: string;
};

// ── Composant principal ─────────────────────────────────────────────────────

export function UserManagementClient({ users, societies, currentUserId }: Props) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [assignTarget, setAssignTarget] = useState<ManagedUser | null>(null);

  const uniqueUsers = users.length;
  const totalAccesses = users.reduce((s, u) => s + u.accesses.length, 0);
  const uniqueProps = new Set(societies.map((s) => s.proprietaireId)).size;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Utilisateurs</p>
            <p className="text-2xl font-bold">{uniqueUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Sociétés</p>
            <p className="text-2xl font-bold">{societies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Propriétaires</p>
            <p className="text-2xl font-bold">{uniqueProps}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table utilisateurs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" />
                Utilisateurs ({uniqueUsers})
              </CardTitle>
              <CardDescription>
                Gérez les accès aux propriétaires et sociétés
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Créer un utilisateur
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Aucun utilisateur</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-8 p-3" />
                    <th className="text-left p-3 font-medium">Utilisateur</th>
                    <th className="text-left p-3 font-medium">Accès</th>
                    <th className="text-center p-3 font-medium">BCC</th>
                    <th className="text-left p-3 font-medium">Dernière connexion</th>
                    <th className="p-3 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isExpanded = expandedUser === user.id;
                    const isSelf = user.id === currentUserId;
                    const firstSocietyId = user.accesses[0]?.societyId;

                    return (
                      <UserRow
                        key={user.id}
                        user={user}
                        isExpanded={isExpanded}
                        isSelf={isSelf}
                        firstSocietyId={firstSocietyId}
                        societies={societies}
                        currentUserId={currentUserId}
                        onToggleExpand={() =>
                          setExpandedUser(isExpanded ? null : user.id)
                        }
                        onAssign={() => setAssignTarget(user)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogues */}
      {showCreate && (
        <CreateUserDialog
          societies={societies}
          onClose={() => setShowCreate(false)}
        />
      )}
      {assignTarget && (
        <AssignAccessDialog
          user={assignTarget}
          societies={societies}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  );
}

// ── Ligne utilisateur (avec détails dépliables) ─────────────────────────────

function UserRow({
  user, isExpanded, isSelf, firstSocietyId, societies, currentUserId,
  onToggleExpand, onAssign,
}: {
  user: ManagedUser;
  isExpanded: boolean;
  isSelf: boolean;
  firstSocietyId: string | undefined;
  societies: AvailableSociety[];
  currentUserId: string;
  onToggleExpand: () => void;
  onAssign: () => void;
}) {
  const [resending, startResend] = useTransition();
  const neverLoggedIn = !user.lastLoginAt;

  function handleResend(e: React.MouseEvent) {
    e.stopPropagation();
    startResend(async () => {
      const result = await resendInvitation(user.id);
      if (result.success) {
        toast.success("Invitation renvoyée par email");
      } else {
        toast.error(result.error ?? "Erreur lors du renvoi");
      }
    });
  }

  return (
    <>
      <tr className="border-b hover:bg-muted/30 cursor-pointer" onClick={onToggleExpand}>
        <td className="p-3 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="p-3">
          <div>
            <span className="font-medium">
              {user.name ?? ""}{user.firstName && !user.name?.includes(user.firstName) ? ` ${user.firstName}` : ""}
            </span>
            {isSelf && (
              <Badge variant="outline" className="ml-2 text-[10px]">
                Vous
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </td>
        <td className="p-3">
          <div className="flex flex-wrap gap-1">
            {user.accesses.map((a) => (
              <Badge
                key={`${a.societyId}`}
                variant={ROLE_VARIANT[a.role] ?? "outline"}
                className="text-[10px] whitespace-nowrap"
              >
                {a.societyName} · {ROLE_LABELS[a.role] ?? a.role}
              </Badge>
            ))}
          </div>
        </td>
        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
          {firstSocietyId && (
            <EmailCopyToggle
              userId={user.id}
              societyId={firstSocietyId}
              enabled={user.emailCopyEnabled}
              canToggle={true}
            />
          )}
        </td>
        <td className="p-3 text-xs">
          {neverLoggedIn ? (
            <span className="text-orange-500 font-medium">En attente d&apos;activation</span>
          ) : (
            <span className="text-muted-foreground">{formatDateTime(user.lastLoginAt)}</span>
          )}
        </td>
        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1.5">
            {neverLoggedIn && !isSelf && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={resending}
                title="Renvoyer l'invitation"
                className="text-muted-foreground hover:text-primary"
              >
                {resending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onAssign}>
              <Plus className="h-3 w-3 mr-1" /> Accès
            </Button>
          </div>
        </td>
      </tr>

      {/* Détails dépliés */}
      {isExpanded && (
        <tr className="border-b bg-muted/20">
          <td />
          <td colSpan={5} className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Détail des accès
            </p>
            <div className="space-y-2">
              {user.accesses.map((a) => (
                <AccessRow
                  key={a.societyId}
                  access={a}
                  userId={user.id}
                  isSelf={user.id === currentUserId}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-xs"
              onClick={onAssign}
            >
              <Plus className="h-3 w-3 mr-1" /> Ajouter un accès
            </Button>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Ligne d'accès (propriétaire → société) ──────────────────────────────────

function AccessRow({
  access, userId, isSelf,
}: {
  access: ManagedUser["accesses"][0];
  userId: string;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(access.role);
  const [editing, setEditing] = useState(false);

  function handleRoleChange(newRole: string) {
    setRole(newRole);
    startTransition(async () => {
      const result = await assignUserToSociety({
        userId,
        societyId: access.societyId,
        role: newRole as "ADMIN_SOCIETE" | "GESTIONNAIRE" | "COMPTABLE" | "LECTURE",
      });
      if (result.success) {
        toast.success("Rôle mis à jour");
        setEditing(false);
      } else {
        toast.error(result.error ?? "Erreur");
        setRole(access.role);
      }
    });
  }

  function handleRemove() {
    if (isSelf) {
      toast.error("Vous ne pouvez pas retirer votre propre accès");
      return;
    }
    startTransition(async () => {
      const result = await removeUserFromSociety(userId, access.societyId);
      if (result.success) {
        toast.success("Accès retiré");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{access.societyName}</p>
        <p className="text-xs text-muted-foreground">{access.proprietaireLabel}</p>
      </div>

      {editing ? (
        <Select value={role} onValueChange={handleRoleChange} disabled={isPending}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge
          variant={ROLE_VARIANT[role] ?? "outline"}
          className="cursor-pointer text-xs"
          onClick={() => setEditing(true)}
        >
          {ROLE_LABELS[role] ?? role}
        </Badge>
      )}

      <Link href={`/administration/utilisateurs/${userId}/permissions`}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
          title="Permissions par module"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
        </Button>
      </Link>

      {!isSelf && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}

// ── Dialogue : Créer un utilisateur ─────────────────────────────────────────

function CreateUserDialog({
  societies, onClose,
}: {
  societies: AvailableSociety[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedSociety, setSelectedSociety] = useState(societies[0]?.id ?? "");
  const [role, setRole] = useState("GESTIONNAIRE");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !selectedSociety) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    startTransition(async () => {
      // 1. Créer l'utilisateur
      const createResult = await createUser({ name, firstName, email });
      if (!createResult.success || !createResult.data) {
        toast.error(createResult.error ?? "Erreur lors de la création");
        return;
      }

      // 2. Assigner à la société
      const assignResult = await assignUserToSociety({
        userId: createResult.data.id,
        societyId: selectedSociety,
        role: role as "ADMIN_SOCIETE" | "GESTIONNAIRE" | "COMPTABLE" | "LECTURE",
      });

      if (assignResult.success) {
        toast.success("Utilisateur créé et invité par email");
        onClose();
      } else {
        toast.error(assignResult.error ?? "Créé mais erreur d'assignation");
      }
    });
  }

  // Grouper les sociétés par propriétaire
  const grouped = societies.reduce<Record<string, AvailableSociety[]>>((acc, s) => {
    const key = s.proprietaireLabel;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un utilisateur</DialogTitle>
          <DialogDescription>
            Un email d&apos;invitation sera envoyé pour créer son mot de passe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nom *</Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-firstName">Prénom</Label>
              <Input
                id="c-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-email">Email *</Label>
            <Input
              id="c-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Société *</Label>
            <Select value={selectedSociety} onValueChange={setSelectedSociety}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une société" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(grouped).map(([propLabel, socs]) => (
                  <div key={propLabel}>
                    <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {propLabel}
                    </p>
                    {socs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Rôle *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Création...</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" /> Créer</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialogue : Ajouter un accès à un utilisateur existant ───────────────────

function AssignAccessDialog({
  user, societies, onClose,
}: {
  user: ManagedUser;
  societies: AvailableSociety[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  // Exclure les sociétés déjà assignées
  const existingIds = new Set(user.accesses.map((a) => a.societyId));
  const available = societies.filter((s) => !existingIds.has(s.id));

  const [selectedSociety, setSelectedSociety] = useState(available[0]?.id ?? "");
  const [role, setRole] = useState("GESTIONNAIRE");

  // Grouper par propriétaire
  const grouped = available.reduce<Record<string, AvailableSociety[]>>((acc, s) => {
    const key = s.proprietaireLabel;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSociety) {
      toast.error("Veuillez sélectionner une société");
      return;
    }

    startTransition(async () => {
      const result = await assignUserToSociety({
        userId: user.id,
        societyId: selectedSociety,
        role: role as "ADMIN_SOCIETE" | "GESTIONNAIRE" | "COMPTABLE" | "LECTURE",
      });
      if (result.success) {
        toast.success("Accès ajouté");
        onClose();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un accès</DialogTitle>
          <DialogDescription>
            Donner à {user.name}{user.firstName ? ` ${user.firstName}` : ""} accès
            à une société supplémentaire.
          </DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <div className="py-6 text-center">
            <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Cet utilisateur a déjà accès à toutes vos sociétés.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Société</Label>
              <Select value={selectedSociety} onValueChange={setSelectedSociety}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une société" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(grouped).map(([propLabel, socs]) => (
                    <div key={propLabel}>
                      <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {propLabel}
                      </p>
                      {socs.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Ajout...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Ajouter</>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
