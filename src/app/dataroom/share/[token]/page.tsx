import { notFound } from "next/navigation";
import { getDataroomByToken } from "@/actions/dataroom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

export default async function DataroomSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const dataroom = await getDataroomByToken(token);
  if (!dataroom) notFound();

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          {dataroom.society.logoUrl && (
            <img src={dataroom.society.logoUrl} alt="" className="h-12 mx-auto mb-4 object-contain" />
          )}
          <h1 className="text-2xl font-bold tracking-tight">{dataroom.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {dataroom.society.name}
          </p>
          {dataroom.description && (
            <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">{dataroom.description}</p>
          )}
          <div className="flex items-center justify-center gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {dataroom.documents.length} document{dataroom.documents.length !== 1 ? "s" : ""}
            </span>
            {dataroom.purpose && <Badge variant="secondary" className="text-xs">{dataroom.purpose}</Badge>}
          </div>
        </div>

        <div className="space-y-3">
          {dataroom.documents.map((dd, i) => (
            <Card key={dd.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <span className="text-sm font-medium text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{dd.document.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {dd.document.category ?? "Document"} · {formatFileSize(dd.document.fileSize ?? 0)}
                  </p>
                </div>
                <a href={dd.document.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Voir</span>
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        {dataroom.documents.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun document dans cette dataroom</p>
            </CardContent>
          </Card>
        )}

        <div className="text-center mt-8 text-xs text-muted-foreground">
          <p>Cet espace de partage est securise et accessible uniquement via ce lien.</p>
        </div>
      </div>
    </div>
  );
}
