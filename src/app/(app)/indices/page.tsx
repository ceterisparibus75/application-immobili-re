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

const ALL_TYPES = ["IRL", "ILC", "ILAT", "ICC"] as const;

const INDEX_INFO: Record<(typeof ALL_TYPES)[number], { name: string; description: string; badge?: string }> = {
  IRL: {
    name: "Indice de Référence des Loyers",
    description: "Référence légale pour réviser les loyers d'habitation",
    badge: "Logements",
  },
  ILC: {
    name: "Indice des Loyers Commerciaux",
    description: "Utilisé pour réviser les loyers des locaux commerciaux",
    badge: "Commerce",
  },
  ILAT: {
    name: "Indice des Loyers des Activités Tertiaires",
    description: "Utilisé pour les bureaux et activités tertiaires",
    badge: "Tertiaire",
  },
  ICC: {
    name: "Indice du Coût de la Construction",
    description: "Ancien indice de référence, toujours utilisé dans certains baux",
    badge: "Construction",
  },
};

async function getLatestAndHistory() {
  const results = await Promise.all(
    ALL_TYPES.map((type) =>
      prisma.inseeIndex.findMany({
        where: { indexType: type },
        orderBy: [{ year: "desc" }, { quarter: "desc" }],
        take: 8,
      })
    )
  );
  return Object.fromEntries(ALL_TYPES.map((type, i) => [type, results[i]])) as Record<
    (typeof ALL_TYPES)[number],
    Awaited<ReturnType<typeof prisma.inseeIndex.findMany>>
  >;
}

export default async function IndicesPage() {
  const data = await getLatestAndHistory();

  const hasAny = ALL_TYPES.some((t) => data[t].length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Indices de révision</h1>
        <p className="text-muted-foreground">
          Indices IRL, ILC, ILAT et ICC publiés par l&apos;INSEE · mise à jour trimestrielle
        </p>
      </div>

      {/* Dernières valeurs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ALL_TYPES.map((code) => {
          const history = data[code];
          const entry = history[0];
          const prev = history[1];
          const info = INDEX_INFO[code];
          const evol = entry && prev
            ? (((entry.value - prev.value) / prev.value) * 100)
            : null;

          return (
            <Card key={code} className={code === "IRL" ? "border-primary/30 bg-primary/5" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    {code}
                  </CardTitle>
                  {info.badge && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {info.badge}
                    </span>
                  )}
                </div>
                <CardDescription className="text-xs">{info.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">
                  {entry ? entry.value.toFixed(2) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry ? `T${entry.quarter} ${entry.year}` : "Non disponible"}
                </p>
                {evol != null && (
                  <p className={`text-xs mt-1 font-medium ${evol >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {evol >= 0 ? "+" : ""}{evol.toFixed(2)}% vs trimestre précédent
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{info.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Historiques */}
      {ALL_TYPES.map((code) => {
        const history = data[code];
        if (!history.length) return null;

        return (
          <Card key={`hist-${code}`}>
            <CardHeader>
              <CardTitle className="text-base">
                Historique {code} — {INDEX_INFO[code].name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Période</th>
                      <th className="pb-2 text-right font-medium">Valeur</th>
                      <th className="pb-2 text-right font-medium">Évolution trimestrielle</th>
                      <th className="pb-2 text-right font-medium">Évolution annuelle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.map((entry, i) => {
                      const prevQ = history[i + 1];
                      const prevY = history[i + 4]; // même trimestre année précédente
                      const evolQ = prevQ
                        ? (((entry.value - prevQ.value) / prevQ.value) * 100)
                        : null;
                      const evolY = prevY
                        ? (((entry.value - prevY.value) / prevY.value) * 100)
                        : null;

                      return (
                        <tr key={entry.id}>
                          <td className="py-2 font-medium">T{entry.quarter} {entry.year}</td>
                          <td className="py-2 text-right tabular-nums font-semibold">
                            {entry.value.toFixed(2)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {evolQ != null ? (
                              <span className={evolQ >= 0 ? "text-green-600" : "text-red-600"}>
                                {evolQ >= 0 ? "+" : ""}{evolQ.toFixed(2)}%
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {evolY != null ? (
                              <span className={evolY >= 0 ? "text-green-600" : "text-red-600"}>
                                {evolY >= 0 ? "+" : ""}{evolY.toFixed(2)}%
                              </span>
                            ) : "—"}
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

      {!hasAny && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune valeur d&apos;indice en base. Le cron de synchronisation INSEE
              alimentera automatiquement cette page chaque trimestre.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
