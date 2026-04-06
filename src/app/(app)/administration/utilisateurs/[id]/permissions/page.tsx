import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getModulePermissions } from "@/actions/user";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import PermissionsMatrix from "./_components/permissions-matrix";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PermissionsPage({ params }: PageProps) {
  const { id: userId } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, firstName: true, email: true },
  });

  if (!user) notFound();

  const result = await getModulePermissions(userId, societyId);
  if (!result.success || !result.data) {
    redirect("/administration/utilisateurs");
  }

  const { role, modulePermissions, isCustom } = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Permissions par module
        </h1>
        <p className="text-muted-foreground">
          Configurez les permissions granulaires pour cet utilisateur
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>
                {user.name}
                {user.firstName ? ` ${user.firstName}` : ""}
              </CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {ROLE_LABELS[role as UserRole]}
              </Badge>
              {isCustom && (
                <Badge variant="secondary">
                  Permissions personnalisees
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PermissionsMatrix
            userId={userId}
            societyId={societyId}
            role={role}
            initialPermissions={modulePermissions}
            isCustom={isCustom}
          />
        </CardContent>
      </Card>
    </div>
  );
}
