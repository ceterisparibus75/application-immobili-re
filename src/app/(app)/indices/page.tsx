import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export const metadata = { title: "Indices" };

const INDEX_INFO: Record<
  string,
  { name: string; description: string }
> = {
  ILC: {
    name: "Indice des Loyers Commerciaux",
    description:
      "Utilisé pour réviser les loyers des locaux commerciaux",
  },
  ILAT: {
    name: "Indice des Loyers des Activités Tertiaires",
    description: "Utilisé pour les bureaux et activités tertiaires",
  },
  ICC: {
    name: "Indice du Coût de la Construction",
    description:
      "Ancien indice de référence, toujours utilisé dans certains baux",
  },
};

async function getLatestIndices() {
  const results = await Promise.all(
    (["ILC", "ILAT", "ICC"] as const).map((type) =>
      prisma.inseeIndex.findFirst({
        where: { indexType: type },
        orderBy: [{ year: "desc" }, { quarter: "desc" }],
      })
    )
  );
  return Object.fromEntries(
    (["ILC", "ILAT", "ICC"] as const).map((type, i) => [type, results[i]])
  );
}

async function getHistoryByType(type: "ILC" | "ILAT" | "ICC") {
  return prisma.inseeIndex.findMany({
    where: { indexType: type },
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
    take: 8,
  });
}

export default async function IndicesPage() {
  const [latest, ilcHistory, ilatHistory, iccHistory] = await Promise.all([
    getLatestIndices(),
    getHistoryByType("ILC"),
    getHistoryByType("ILAT"),
    getHistoryByType("ICC"),
  ]);

  const historyMap = {
    ILC: ilcHistory,
    ILAT: ilatHistory,
    ICC: iccHistory,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Indices de révision</h1>
        <p className="text-muted-foreground">
          Indices ILC, ILAT et ICC publiés par l&apos;INSEE
        </p>
      </div>

      {/* Dernières valeurs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(["ILC", "ILAT", "ICC"] as const).map((code) => {
          const entry = latest[code];
          const info = INDEX_INFO[code];
          return (
            <Card key={code}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {code}
                </CardTitle>
                <CardDescription>{info.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">
                  {info.description}
                </p>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Dernière valeur publiée
                  </p>
                  <p className="text-2xl font-bold">
                    {entry ? entry.value.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry
                      ? `T${entry.quarter} ${entry.year}`
                      : "Non disponible"}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Historique */}
      {(["ILC", "ILAT", "ICC"] as const).map((code) => {
        const history = historyMap[code];
        if (!history.length) return null;

        return (
          <Card key={`hist-${code}`}>
            <CardHeader>
              <CardTitle className="text-base">Historique {code}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Période</th>
                      <th className="pb-2 text-right font-medium">Valeur</th>
                      <th className="pb-2 text-right font-medium">
                        Évolution
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.map((entry, i) => {
                      const prev = history[i + 1];
                      const evol = prev
                        ? (((entry.value - prev.value) / prev.value) * 100).toFixed(2)
                        : null;
                      return (
                        <tr key={entry.id}>
                          <td className="py-1.5">
                            T{entry.quarter} {entry.year}
                          </td>
                          <td className="py-1.5 text-right tabular-nums font-medium">
                            {entry.value.toFixed(1)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {evol != null ? (
                              <span
                                className={
                                  parseFloat(evol) >= 0
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                }
                              >
                                {parseFloat(evol) >= 0 ? "+" : ""}
                                {evol}%
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {Object.values(latest).every((v) => !v) && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune valeur d&apos;indice en base. La mise à jour automatique
              depuis l&apos;INSEE sera disponible prochainement.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
