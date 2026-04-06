"use client";

import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save } from "lucide-react";
import {
  updateModulePermissions,
  resetModulePermissions,
} from "@/actions/user";
import {
  MODULES,
  MODULE_LABELS,
  getDefaultPermissions,
  type ModulePermissions,
  type Module,
  type Permission,
} from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

interface PermissionsMatrixProps {
  userId: string;
  societyId: string;
  role: string;
  initialPermissions: ModulePermissions;
  isCustom: boolean;
}

const PERMISSION_LABELS: Record<Permission, string> = {
  read: "Lecture",
  write: "Ecriture",
  delete: "Suppression",
};

const PERMISSIONS: Permission[] = ["read", "write", "delete"];

export default function PermissionsMatrix({
  userId,
  societyId,
  role,
  initialPermissions,
  isCustom: initialIsCustom,
}: PermissionsMatrixProps) {
  const [permissions, setPermissions] = useState<ModulePermissions>(initialPermissions);
  const [isCustom, setIsCustom] = useState(initialIsCustom);
  const [isPending, startTransition] = useTransition();

  const defaults = getDefaultPermissions(role as UserRole);

  const hasPermission = useCallback(
    (module: Module, permission: Permission): boolean => {
      return permissions[module]?.includes(permission) ?? false;
    },
    [permissions]
  );

  const isDefault = useCallback(
    (module: Module, permission: Permission): boolean => {
      return defaults[module]?.includes(permission) ?? false;
    },
    [defaults]
  );

  const togglePermission = useCallback(
    (module: Module, permission: Permission) => {
      setPermissions((prev) => {
        const current = prev[module] ?? [];
        let updated: Permission[];

        if (current.includes(permission)) {
          updated = current.filter((p) => p !== permission);
          // If removing write or delete, that's fine
        } else {
          updated = [...current, permission];
          // If adding write or delete, ensure read is also present
          if ((permission === "write" || permission === "delete") && !updated.includes("read")) {
            updated = ["read", ...updated];
          }
        }

        // If removing read, also remove write and delete
        if (permission === "read" && !updated.includes("read")) {
          updated = [];
        }

        return { ...prev, [module]: updated };
      });
    },
    []
  );

  const handleSave = useCallback(() => {
    startTransition(async () => {
      const result = await updateModulePermissions({
        userId,
        societyId,
        modulePermissions: permissions,
      });

      if (result.success) {
        setIsCustom(true);
        toast.success("Permissions mises a jour");
      } else {
        toast.error(result.error ?? "Erreur lors de la sauvegarde");
      }
    });
  }, [userId, societyId, permissions]);

  const handleReset = useCallback(() => {
    startTransition(async () => {
      const result = await resetModulePermissions(userId, societyId);

      if (result.success) {
        setPermissions(getDefaultPermissions(role as UserRole));
        setIsCustom(false);
        toast.success("Permissions reinitialises aux valeurs par defaut");
      } else {
        toast.error(result.error ?? "Erreur lors de la reinitialisation");
      }
    });
  }, [userId, societyId, role]);

  const handleResetLocal = useCallback(() => {
    setPermissions(getDefaultPermissions(role as UserRole));
  }, [role]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Les cases surlignees indiquent les permissions par defaut du role. Vous
        pouvez personnaliser les permissions en cochant/decochant les cases.
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium min-w-[160px]">
                Module
              </th>
              {PERMISSIONS.map((perm) => (
                <th key={perm} className="text-center p-3 font-medium w-32">
                  {PERMISSION_LABELS[perm]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((module) => (
              <tr key={module} className="border-b hover:bg-muted/30">
                <td className="p-3 font-medium">{MODULE_LABELS[module]}</td>
                {PERMISSIONS.map((perm) => {
                  const checked = hasPermission(module, perm);
                  const isDefaultPerm = isDefault(module, perm);

                  return (
                    <td
                      key={perm}
                      className={`text-center p-3 ${
                        isDefaultPerm ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            togglePermission(module, perm)
                          }
                          disabled={isPending}
                          aria-label={`${MODULE_LABELS[module]} - ${PERMISSION_LABELS[perm]}`}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetLocal}
            disabled={isPending}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Valeurs par defaut du role
          </Button>
          {isCustom && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isPending}
            >
              Supprimer la personnalisation
            </Button>
          )}
        </div>

        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
