import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDocuments } from "@/actions/document";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText, Plus, ExternalLink, FolderOpen, Building2, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { DeleteDocumentButton } from "./_components/delete-button";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/dashboard");

  // Tous les documents scopés à la société active
  const documents = await getDocuments(societyId);

  const categoryLabel = (cat: string | null) =>
    DOCUMENT_CATEGORIES.find((c) => c.value === cat)?.label ?? "Autre";

  function isExpired(d: Date | null) {
    return d ? d.getTime() < Date.now() : false;
  }
  function isExpiringSoon(d: Date | null) {
    if (!d) return false;
    const diff = d.getTime() - Date.now();
    return diff > 0 && diff < 60 * 24 * 3600 * 1000;
  }

  // ── Regroupement par immeuble ──────────────────────────────────────────────
  // Un document est "lié à un immeuble" si buildingId direct, ou via lot.building, lease.lot.building, etc.
  function getBuildingKey(doc: (typeof documents)[number]): string | null {
    if (doc.buildingId) return doc.buildingId;
    if (doc.lot?.building) return doc.lot.building.name; // use name as key since id not in lot.building
    if (doc.lease?.lot?.building) return doc.lease.lot.building.name;
    return null;
  }
  function getBuildingLabel(doc: (typeof documents)[number]): string {
    if (doc.building) return doc.building.name;
    if (doc.lot?.building) return doc.lot.building.name;
    if (doc.lease?.lot?.building) return doc.lease.lot.building.name;
    return "";
  }
  function getTenantLabel(doc: (typeof documents)[number]): string | null {
    if (doc.tenant) {
      const t = doc.tenant;
      return t.entityType === "PERSONNE_MORALE"
        ? (t.companyName ?? "Locataire")
        : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim();
    }
    if (doc.lease?.tenant) {
      const t = doc.lease.tenant;
      return t.entityType === "PERSONNE_MORALE"
        ? (t.companyName ?? "Locataire")
        : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim();
    }
    return null;
  }

  // Grouper par immeuble
  const byBuilding = new Map<string, { label: string; docs: typeof documents }>();
  const general: typeof documents = [];

  for (const doc of documents) {
    const key = getBuildingKey(doc);
    if (key) {
      if (!byBuilding.has(key)) {
        byBuilding.set(key, { label: getBuildingLabel(doc), docs: [] });
      }
      byBuilding.get(key)!.docs.push(doc);
    } else {
      general.push(doc);
    }
  }

  // Grouper les docs d'un groupe par catégorie
  function groupByCategory(docs: typeof documents) {
    const map = new Map<string, typeof documents>();
    for (const doc of docs) {
      const cat = doc.category ?? "autre";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(doc);
    }
    return map;
  }

  function DocCard({ doc }: { doc: (typeof documents)[number] }) {
    const expired = isExpired(doc.expiresAt);
    const expiringSoon = !expired && isExpiringSoon(doc.expiresAt);
    const tenant = getTenantLabel(doc);

    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-accent/30 transition-colors">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{doc.fileName}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {tenant && (
              <span className="text-xs text-muted-foreground">{tenant}</span>
            )}
            {doc.lot && (
              <span className="text-xs text-muted-foreground">Lot {doc.lot.number}</span>
            )}
            {doc.description && (
              <span className="text-xs text-muted-foreground">· {doc.description}</span>
            )}
            {expired && (
              <Badge variant="destructive" className="text-xs py-0">
                <AlertTriangle className="h-3 w-3 mr-0.5" />
                Expiré {formatDate(doc.expiresAt!)}
              </Badge>
            )}
            {expiringSoon && (
              <Badge className="text-xs py-0 bg-orange-100 text-orange-700 hover:bg-orange-100">
                <AlertTriangle className="h-3 w-3 mr-0.5" />
                Expire {formatDate(doc.expiresAt!)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
          <DeleteDocumentButton
            societyId={societyId!}
            documentId={doc.id}
            fileName={doc.fileName}
          />
        </div>
      </div>
    );
  }

  function BuildingSection({
    label,
    docs,
  }: {
    label: string;
    docs: typeof documents;
  }) {
    const byCat = groupByCategory(docs);
    const alertCount = docs.filter(
      (d) => isExpired(d.expiresAt) || isExpiringSoon(d.expiresAt)
    ).length;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            {label}
            <span className="text-sm font-normal text-muted-foreground">
              ({docs.length} document{docs.length !== 1 ? "s" : ""})
            </span>
            {alertCount > 0 && (
              <Badge className="ml-auto text-xs bg-orange-100 text-orange-700 hover:bg-orange-100">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {alertCount} alerte{alertCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from(byCat.entries()).map(([cat, catDocs]) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {categoryLabel(cat)}
              </p>
              <div className="space-y-1.5">
                {catDocs.map((doc) => (
                  <DocCard key={doc.id} doc={doc} />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? "s" : ""} · classés par immeuble
          </p>
        </div>
        <Link href="/documents/nouveau">
          <Button>
            <Plus className="h-4 w-4" />
            Ajouter un document
          </Button>
        </Link>
      </div>

      {/* État vide */}
      {documents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">Aucun document</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm">
              Centralisez titres de propriété, baux, diagnostics, contrats et factures.
            </p>
            <Link href="/documents/nouveau">
              <Button><Plus className="h-4 w-4" />Ajouter le premier document</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Vue par immeuble */}
      {Array.from(byBuilding.entries()).map(([key, { label, docs }]) => (
        <BuildingSection key={key} label={label} docs={docs} />
      ))}

      {/* Documents sans immeuble */}
      {general.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              Documents généraux
              <span className="text-sm font-normal text-muted-foreground">
                ({general.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from(groupByCategory(general).entries()).map(([cat, catDocs]) => (
              <div key={cat}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {categoryLabel(cat)}
                </p>
                <div className="space-y-1.5">
                  {catDocs.map((doc) => (
                    <DocCard key={doc.id} doc={doc} />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
