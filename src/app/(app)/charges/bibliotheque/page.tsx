import { getSocietyChargeCategories } from "@/actions/charge";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Pencil } from "lucide-react";
import Link from "next/link";
import { DeleteSocietyCategoryButton } from "./_components/delete-button";

export const metadata = { title: "Bibliothèque de charges" };

const NATURE_LABELS = { PROPRIETAIRE: "Propriétaire", RECUPERABLE: "Récupérable", MIXTE: "Mixte" };
const NATURE_VARIANTS = { PROPRIETAIRE: "secondary", RECUPERABLE: "default", MIXTE: "warning" } as const;
const METHOD_LABELS = { TANTIEME: "Tantièmes", SURFACE: "Surface", NB_LOTS: "Nb lots", COMPTEUR: "Compteur", PERSONNALISE: "Personnalisé" };

export default async function BibliothequeChargesPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const categories = await getSocietyChargeCategories(societyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bibliothèque de charges</h1>
          <p className="text-muted-foreground">
            Catalogue de catégories partagées entre tous vos immeubles
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/charges">
            <Button variant="outline">Retour aux charges</Button>
          </Link>
          <Link href="/charges/bibliotheque/nouvelle">
            <Button>
              <Plus className="h-4 w-4" />
              Nouvelle catégorie
            </Button>
          </Link>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Bibliothèque vide</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Créez votre catalogue de catégories de charges pour les réutiliser facilement sur tous vos immeubles.
            </p>
            <Link href="/charges/bibliotheque/nouvelle">
              <Button><Plus className="h-4 w-4" /> Créer la première catégorie</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{categories.length} catégorie{categories.length > 1 ? "s" : ""} dans la bibliothèque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <Badge variant={NATURE_VARIANTS[cat.nature]}>{NATURE_LABELS[cat.nature]}</Badge>
                      <Badge variant="outline">{METHOD_LABELS[cat.allocationMethod]}</Badge>
                      {cat.nature === "MIXTE" && cat.recoverableRate != null && (
                        <Badge variant="secondary">{cat.recoverableRate}% récupérable</Badge>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/charges/bibliotheque/${cat.id}/modifier`}>
                      <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <DeleteSocietyCategoryButton id={cat.id} societyId={societyId} name={cat.name} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
