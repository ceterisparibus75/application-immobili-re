"use client";

import { useEffect, useState } from "react";
import { useSociety } from "@/providers/society-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  entityId: string;
  details: Record<string, unknown> | null;
  user: { id: string; name: string | null; email: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  LOGIN: "Connexion",
  EXPORT: "Export",
  SEND_EMAIL: "Email envoyé",
  GENERATE_PDF: "PDF généré",
};

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  CREATE: "success",
  UPDATE: "default",
  DELETE: "destructive",
  LOGIN: "secondary",
  EXPORT: "outline",
  SEND_EMAIL: "outline",
  GENERATE_PDF: "outline",
};

export default function AuditPage() {
  const { activeSociety } = useSociety();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!activeSociety) return;
    loadLogs();
  }, [activeSociety, page]);

  async function loadLogs() {
    if (!activeSociety) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/audit?societyId=${activeSociety.id}&page=${page}`
      );
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotalPages(data.totalPages);
      }
    } catch {
      console.error("Failed to load audit logs");
    }
    setIsLoading(false);
  }

  if (!activeSociety) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Journal d'audit</h1>
        <p className="text-muted-foreground">
          Sélectionnez une société pour consulter les logs d'audit.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Journal d'audit</h1>
        <p className="text-muted-foreground">
          Historique des actions dans {activeSociety.name}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ScrollText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun log d'audit
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">
                        Utilisateur
                      </th>
                      <th className="text-left p-3 font-medium">Action</th>
                      <th className="text-left p-3 font-medium">Entité</th>
                      <th className="text-left p-3 font-medium">Détails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b hover:bg-muted/30"
                      >
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="p-3">
                          {log.user?.name || log.user?.email || "Système"}
                        </td>
                        <td className="p-3">
                          <Badge variant={ACTION_VARIANTS[log.action] || "outline"}>
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {log.entity}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                          {log.details
                            ? JSON.stringify(log.details)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} sur {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
