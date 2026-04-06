"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  assignUserToSociety,
  createUser,
  removeUserFromSociety,
  deleteUser,
} from "@/actions/user";
import { toast } from "sonner";
import { Loader2, Pencil, UserMinus, Check, X, ShieldCheck } from "lucide-react";
import type { UserRole } from "@/generated/prisma/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ROLE_OPTIONS = [
  { value: "ADMIN_SOCIETE", label: "Administrateur Société" },
  { value: "GESTIONNAIRE", label: "Gestionnaire" },
  { value: "COMPTABLE", label: "Comptable" },
  { value: "LECTURE", label: "Lecture seule" },
];

// ─── Mode "manage" : changer le rôle ou retirer un membre ───────────────────
interface ManageProps {
  mode: "manage";
  societyId: string;
  userId: string;
  currentRole: UserRole;
}

// ─── Mode "add-existing" : ajouter un utilisateur existant ──────────────────
interface AddExistingProps {
  mode: "add-existing";
  societyId: string;
  availableUsers: { id: string; email: string; name: string | null; firstName: string | null }[];
}

// ─── Mode "create" : créer un nouvel utilisateur ────────────────────────────
interface CreateProps {
  mode: "create";
  societyId: string;
}

type UsersClientProps = ManageProps | AddExistingProps | CreateProps;

export default function UsersClient(props: UsersClientProps) {
  const router = useRouter();

  if (props.mode === "manage") return <ManageUser {...props} onDone={() => router.refresh()} />;
  if (props.mode === "add-existing") return <AddExistingUser {...props} onDone={() => router.refresh()} />;
  return <CreateUser {...props} onDone={() => router.refresh()} />;
}

// ─── Composant pour gérer un membre existant ────────────────────────────────
function ManageUser({
  societyId,
  userId,
  currentRole,
  onDone,
}: ManageProps & { onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<string>(currentRole);

  function handleChangeRole() {
    startTransition(async () => {
      const result = await assignUserToSociety({
        userId,
        societyId,
        role: role as UserRole,
      });
      if (result.success) {
        toast.success("Rôle mis à jour");
        setEditing(false);
        onDone();
      } else {
        toast.error(result.error ?? "Erreur lors de la mise à jour");
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeUserFromSociety(userId, societyId);
      if (result.success) {
        toast.success("Utilisateur retiré de la société");
        onDone();
      } else {
        toast.error(result.error ?? "Erreur lors du retrait");
      }
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-green-600"
          onClick={handleChangeRole}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => setEditing(false)}
          disabled={isPending}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <Link href={`/administration/utilisateurs/${userId}/permissions`}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Permissions par module"
        >
          <ShieldCheck className="h-3 w-3" />
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => setEditing(true)}
        title="Changer le rôle"
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
        onClick={handleRemove}
        disabled={isPending}
        title="Retirer de la société"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <UserMinus className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}

// ─── Composant pour ajouter un utilisateur existant ─────────────────────────
function AddExistingUser({
  societyId,
  availableUsers,
  onDone,
}: AddExistingProps & { onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState("GESTIONNAIRE");

  const userOptions = availableUsers.map((u) => ({
    value: u.id,
    label: `${u.name ?? ""}${u.firstName ? " " + u.firstName : ""} — ${u.email}`,
  }));

  function handleAdd() {
    if (!selectedUserId) return;
    startTransition(async () => {
      const result = await assignUserToSociety({
        userId: selectedUserId,
        societyId,
        role: role as UserRole,
      });
      if (result.success) {
        toast.success("Utilisateur ajouté à la société");
        setSelectedUserId("");
        onDone();
      } else {
        toast.error(result.error ?? "Erreur lors de l'ajout");
      }
    });
  }

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div className="space-y-2 flex-1 min-w-48">
        <Label>Utilisateur</Label>
        <Select value={selectedUserId} onValueChange={(val) => setSelectedUserId(val)}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un utilisateur..." />
          </SelectTrigger>
          <SelectContent>
            {userOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 w-48">
        <Label>Rôle</Label>
        <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={handleAdd}
        disabled={!selectedUserId || isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Ajouter
      </Button>
    </div>
  );
}

// ─── Composant pour créer un nouvel utilisateur ─────────────────────────────
function CreateUser({
  societyId,
  onDone,
}: CreateProps & { onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;
    const form = e.currentTarget;

    startTransition(async () => {
      const result = await createUser({
        email: data.email,
        name: data.name,
        firstName: data.firstName,
        password: data.password,
      });

      if (!result.success || !result.data) {
        toast.error(result.error ?? "Erreur lors de la création");
        return;
      }

      // Assigner à la société
      const assignResult = await assignUserToSociety({
        userId: result.data.id,
        societyId,
        role: data.role as UserRole,
      });

      if (assignResult.success) {
        toast.success("Utilisateur créé et ajouté à la société");
        form.reset();
        setOpen(false);
        onDone();
      } else {
        toast.error(assignResult.error ?? "Erreur lors de l'assignation");
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Créer un utilisateur
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nom *</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="firstName">Prénom</Label>
          <Input id="firstName" name="firstName" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Rôle *</Label>
          <select id="role" name="role" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
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
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Créer
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
