import { getAdminSupervision } from "@/actions/admin-supervision";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Building2,
  Lock,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

export const metadata = { title: "Supervision admin" };
export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Connexion réussie",
  LOGIN_FAILED: "Échec connexion",
  ACCOUNT_LOCKED: "Compte verrouillé",
  TWO_FACTOR_LOGIN: "Connexion 2FA",
  ACTION: "Action",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  LOGIN: "Connexion",
  EXPORT: "Export",
  SEND_EMAIL: "Email",
  GENERATE_PDF: "PDF",
};

function displayName(user: { firstName?: string | null; name?: string | null; email: string }) {
  return [user.firstName, user.name].filter(Boolean).join(" ") || user.email;
}

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: number | string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive bg-destructive/10"
      : tone === "warning"
        ? "text-[var(--color-status-caution)] bg-[var(--color-status-caution-bg)]"
        : "text-primary bg-primary/10";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className={`rounded-md p-2 ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

export default async function AdminSupervisionPage() {
  const result = await getAdminSupervision();

  if (!result.success || !result.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Supervision admin</h1>
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium">Accès indisponible</p>
                <p className="text-sm text-muted-foreground">
                  {result.error ?? "Seuls les super administrateurs peuvent consulter cette vue."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = result.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supervision admin</h1>
          <p className="text-muted-foreground">
            Vision globale du site, des comptes, des sociétés et des connexions.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/administration/utilisateurs"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <Users className="h-4 w-4" />
            Utilisateurs
          </Link>
          <Link
            href="/administration/audit"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <Activity className="h-4 w-4" />
            Audit
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Utilisateurs"
          value={data.stats.totalUsers}
          detail={`${data.stats.activeUsers} actifs, ${data.stats.usersCreated30d} créés sur 30 jours`}
          icon={Users}
        />
        <StatCard
          title="Connexions"
          value={data.stats.usersLogged7d}
          detail="utilisateurs connectés sur 7 jours"
          icon={Activity}
        />
        <StatCard
          title="Sociétés"
          value={data.stats.totalSocieties}
          detail={`${data.stats.activeSocieties} actives, ${data.stats.societiesCreated30d} créées sur 30 jours`}
          icon={Building2}
        />
        <StatCard
          title="Sécurité"
          value={data.stats.lockedUsers}
          detail={`${data.stats.failedAttemptUsers} compte(s) avec échecs en cours`}
          icon={Lock}
          tone={data.stats.lockedUsers > 0 ? "danger" : data.stats.failedAttemptUsers > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Abonnements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.subscriptionStatus.length === 0 ? (
              <EmptyState label="Aucun abonnement." />
            ) : (
              data.subscriptionStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between text-sm">
                  <Badge variant="outline">{item.status}</Badge>
                  <span className="font-semibold tabular-nums">{item.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rôles attribués</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.roles.map((item) => (
              <div key={item.role} className="flex items-center justify-between text-sm">
                <Badge variant={item.role === "SUPER_ADMIN" ? "default" : "outline"}>{item.role}</Badge>
                <span className="font-semibold tabular-nums">{item.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Raccourcis de contrôle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Link href="/administration/audit?action=LOGIN" className="flex items-center gap-2 text-primary hover:underline">
              <Activity className="h-4 w-4" />
              Voir les connexions dans l’audit
            </Link>
            <Link href="/administration/utilisateurs" className="flex items-center gap-2 text-primary hover:underline">
              <UserPlus className="h-4 w-4" />
              Gérer les profils et accès
            </Link>
            <Link href="/administration/audit?entity=UserSociety&action=CREATE" className="flex items-center gap-2 text-primary hover:underline">
              <ShieldCheck className="h-4 w-4" />
              Profils créés par société
            </Link>
            <p className="pt-2 text-xs text-muted-foreground">
              Dernière mise à jour : {formatDateTime(data.generatedAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connexions récentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentLogins.length === 0 ? (
              <EmptyState label="Aucune connexion journalisée." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Date</th>
                      <th className="p-3 text-left font-medium">Utilisateur</th>
                      <th className="p-3 text-left font-medium">Société</th>
                      <th className="p-3 text-left font-medium">Événement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLogins.map((login) => (
                      <tr key={login.id} className="border-b">
                        <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                          {formatDateTime(login.createdAt)}
                        </td>
                        <td className="p-3">{login.userName ?? login.email ?? "Utilisateur inconnu"}</td>
                        <td className="p-3 text-muted-foreground">{login.societyName}</td>
                        <td className="p-3">
                          <Badge variant={login.event === "LOGIN_FAILED" || login.event === "ACCOUNT_LOCKED" ? "destructive" : "outline"}>
                            {EVENT_LABELS[login.event] ?? login.event}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profils créés récemment</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentProfiles.length === 0 ? (
              <EmptyState label="Aucun profil créé." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Date</th>
                      <th className="p-3 text-left font-medium">Utilisateur</th>
                      <th className="p-3 text-left font-medium">Société</th>
                      <th className="p-3 text-left font-medium">Rôle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentProfiles.map((profile) => (
                      <tr key={profile.id} className="border-b">
                        <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                          {formatDateTime(profile.createdAt)}
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{displayName(profile.user)}</div>
                          <div className="text-xs text-muted-foreground">{profile.user.email}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{profile.society.name}</td>
                        <td className="p-3">
                          <Badge variant={profile.role === "SUPER_ADMIN" ? "default" : "outline"}>{profile.role}</Badge>
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouveaux utilisateurs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Utilisateur</th>
                    <th className="p-3 text-left font-medium">Créé le</th>
                    <th className="p-3 text-left font-medium">Dernière connexion</th>
                    <th className="p-3 text-left font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentUsers.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="p-3">
                        <div className="font-medium">{displayName(user)}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Jamais"}
                      </td>
                      <td className="p-3">
                        <Badge variant={user.lockedUntil && user.lockedUntil > new Date() ? "destructive" : user.isActive ? "outline" : "secondary"}>
                          {user.lockedUntil && user.lockedUntil > new Date() ? "Verrouillé" : user.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sociétés les plus utilisées</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Société</th>
                    <th className="p-3 text-left font-medium">Plan</th>
                    <th className="p-3 text-right font-medium">Membres</th>
                    <th className="p-3 text-right font-medium">Baux</th>
                  </tr>
                </thead>
                <tbody>
                  {data.largestSocieties.map((society) => (
                    <tr key={society.id} className="border-b">
                      <td className="p-3">
                        <div className="font-medium">{society.name}</div>
                        <div className="text-xs text-muted-foreground">{society.legalForm}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">
                          {society.subscription?.planId ?? "Sans abonnement"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right tabular-nums">{society._count.userSocieties}</td>
                      <td className="p-3 text-right tabular-nums">{society._count.leases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernières actions globales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentAuditEvents.length === 0 ? (
            <EmptyState label="Aucune action récente." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Date</th>
                    <th className="p-3 text-left font-medium">Action</th>
                    <th className="p-3 text-left font-medium">Utilisateur</th>
                    <th className="p-3 text-left font-medium">Société</th>
                    <th className="p-3 text-left font-medium">Entité</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentAuditEvents.map((event) => (
                    <tr key={event.id} className="border-b">
                      <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                        {formatDateTime(event.createdAt)}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{ACTION_LABELS[event.action] ?? event.action}</Badge>
                      </td>
                      <td className="p-3">{event.userName ?? event.userEmail ?? "Système"}</td>
                      <td className="p-3 text-muted-foreground">{event.societyName}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{event.entity}</td>
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
