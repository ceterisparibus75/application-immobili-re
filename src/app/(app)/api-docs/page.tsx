import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Code2, Key, Webhook, BookOpen, Zap, Shield,
  ArrowRight, Copy, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/buildings", description: "Lister les immeubles", tag: "Patrimoine" },
  { method: "GET", path: "/api/v1/buildings/:id", description: "Détail d'un immeuble", tag: "Patrimoine" },
  { method: "GET", path: "/api/v1/lots", description: "Lister les lots", tag: "Patrimoine" },
  { method: "GET", path: "/api/v1/tenants", description: "Lister les locataires", tag: "Locataires" },
  { method: "GET", path: "/api/v1/leases", description: "Lister les baux", tag: "Baux" },
  { method: "GET", path: "/api/v1/invoices", description: "Lister les factures", tag: "Facturation" },
  { method: "GET", path: "/api/v1/webhooks", description: "Lister les webhooks", tag: "Webhooks" },
  { method: "POST", path: "/api/v1/webhooks", description: "Créer un webhook", tag: "Webhooks" },
];

const WEBHOOK_EVENTS = [
  { event: "invoice.created", description: "Nouvelle facture créée" },
  { event: "invoice.paid", description: "Facture marquée comme payée" },
  { event: "invoice.overdue", description: "Facture en retard de paiement" },
  { event: "lease.created", description: "Nouveau bail créé" },
  { event: "lease.terminated", description: "Bail résilié" },
  { event: "tenant.created", description: "Nouveau locataire ajouté" },
  { event: "payment.received", description: "Paiement reçu" },
  { event: "building.created", description: "Nouvel immeuble créé" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

export default async function ApiDocsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Code2 className="h-6 w-6 text-[var(--color-brand-blue)]" />
          API publique
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Intégrez MyGestia avec vos outils via notre API REST. Nécessite un plan Institutionnel.
        </p>
      </div>

      {/* Quick start */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-brand">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-500" />
              Authentification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Deux méthodes d&apos;authentification supportées :
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Bearer</Badge>
                <span>Token JWT via <code className="bg-muted px-1 rounded">Authorization</code></span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">API Key</Badge>
                <span>Clé via header <code className="bg-muted px-1 rounded">X-API-Key</code></span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-brand">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              Format de réponse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-3 font-mono text-[11px] leading-relaxed">
              <div className="text-muted-foreground">{"{"}</div>
              <div className="ml-2">&quot;data&quot;: [...],</div>
              <div className="ml-2">&quot;meta&quot;: {"{"}</div>
              <div className="ml-4">&quot;total&quot;: 42,</div>
              <div className="ml-4">&quot;page&quot;: 1</div>
              <div className="ml-2">{"}"}</div>
              <div className="text-muted-foreground">{"}"}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-brand">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              Rate Limiting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Limites par défaut :</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>Lecture</span>
                <span className="font-mono tabular-nums">100 req/min</span>
              </div>
              <div className="flex justify-between">
                <span>Écriture</span>
                <span className="font-mono tabular-nums">30 req/min</span>
              </div>
              <div className="flex justify-between">
                <span>Webhooks</span>
                <span className="font-mono tabular-nums">10 req/min</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OpenAPI spec link */}
      <Card className="border-[var(--color-brand-cyan)]/30 bg-[var(--color-brand-light)]/20">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-[var(--color-brand-cyan)]" />
            <div>
              <p className="text-sm font-semibold">Spécification OpenAPI 3.1</p>
              <p className="text-xs text-muted-foreground">
                Importez dans Postman, Insomnia ou tout autre client API
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-3 py-1.5 rounded font-mono">/api/v1/openapi</code>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card className="shadow-brand">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Endpoints
          </CardTitle>
          <CardDescription>
            Tous les endpoints REST disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {ENDPOINTS.map((ep) => (
              <div key={`${ep.method}-${ep.path}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors">
                <Badge className={`${METHOD_COLORS[ep.method]} text-[10px] font-mono w-12 justify-center`}>
                  {ep.method}
                </Badge>
                <code className="text-sm font-mono flex-1">{ep.path}</code>
                <span className="text-xs text-muted-foreground hidden sm:inline">{ep.description}</span>
                <Badge variant="outline" className="text-[9px]">{ep.tag}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card className="shadow-brand">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Événements Webhook
          </CardTitle>
          <CardDescription>
            Recevez des notifications en temps réel sur votre endpoint
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((we) => (
              <div key={we.event} className="flex items-center gap-3 p-3 rounded-lg border">
                <code className="text-xs font-mono bg-violet-100 text-violet-700 px-2 py-0.5 rounded">{we.event}</code>
                <span className="text-xs text-muted-foreground">{we.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Example */}
      <Card className="shadow-brand">
        <CardHeader>
          <CardTitle className="text-base">Exemple de requête</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-[#0B1120] rounded-xl p-4 overflow-x-auto">
            <pre className="text-sm font-mono text-emerald-400 leading-relaxed">
              <code>{`curl -X GET "https://app.mygestia.immo/api/v1/buildings" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json"`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
