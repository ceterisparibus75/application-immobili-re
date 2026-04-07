"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createInspection } from "@/actions/inspection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

const TYPE_OPTIONS = [
  { value: "ENTREE", label: "État des lieux d'entrée" },
  { value: "SORTIE", label: "État des lieux de sortie" },
];

const CONDITION_OPTIONS = [
  { value: "BON", label: "Bon état" },
  { value: "USAGE_NORMAL", label: "Usage normal" },
  { value: "DEGRADE", label: "Dégradé" },
  { value: "TRES_DEGRADE", label: "Très dégradé" },
];

/** Modèles de pièces par type de bail */
const ROOM_TEMPLATES: Record<string, string[]> = {
  HABITATION: [
    "Entrée / Couloir", "Salon / Séjour", "Cuisine", "Chambre 1",
    "Salle de bain", "WC", "Balcon / Terrasse", "Cave / Parking",
  ],
  MEUBLE: [
    "Entrée / Couloir", "Salon / Séjour", "Cuisine équipée", "Chambre 1",
    "Salle de bain", "WC", "Balcon / Terrasse",
  ],
  ETUDIANT: [
    "Entrée", "Pièce principale", "Cuisine / Kitchenette",
    "Salle d'eau", "WC",
  ],
  MOBILITE: [
    "Entrée", "Pièce principale", "Cuisine / Kitchenette",
    "Salle d'eau", "WC",
  ],
  COLOCATION: [
    "Entrée / Couloir", "Salon / Séjour", "Cuisine", "Chambre 1",
    "Chambre 2", "Salle de bain", "WC", "Balcon / Terrasse",
  ],
  SAISONNIER: [
    "Entrée", "Séjour", "Cuisine", "Chambre 1",
    "Salle de bain", "Extérieur",
  ],
  LOGEMENT_FONCTION: [
    "Entrée / Couloir", "Salon / Séjour", "Cuisine", "Chambre 1",
    "Salle de bain", "WC",
  ],
  ANAH: [
    "Entrée / Couloir", "Salon / Séjour", "Cuisine", "Chambre 1",
    "Salle de bain", "WC", "Parties communes",
  ],
  CIVIL: [
    "Entrée / Couloir", "Salon / Séjour", "Cuisine", "Chambre 1",
    "Salle de bain", "WC",
  ],
  GLISSANT: [
    "Entrée / Couloir", "Salon / Séjour", "Cuisine", "Chambre 1",
    "Salle de bain", "WC",
  ],
  SOUS_LOCATION: [
    "Entrée / Couloir", "Pièce principale", "Cuisine",
    "Salle de bain", "WC",
  ],
  COMMERCIAL_369: [
    "Accueil / Réception", "Bureau principal", "Salle de réunion",
    "Sanitaires", "Local technique", "Réserve / Stockage",
    "Parking", "Façade / Vitrine",
  ],
  DEROGATOIRE: [
    "Espace principal", "Sanitaires", "Réserve",
  ],
  PRECAIRE: [
    "Espace principal", "Sanitaires",
  ],
  BAIL_PROFESSIONNEL: [
    "Accueil", "Bureau 1", "Bureau 2", "Salle de réunion",
    "Sanitaires", "Cuisine / Office", "Local technique",
  ],
  MIXTE: [
    "Entrée commune", "Espace professionnel", "Salon / Séjour",
    "Cuisine", "Chambre", "Salle de bain", "WC",
  ],
  EMPHYTEOTIQUE: [
    "Terrain / Parcelle", "Bâtiment principal", "Annexes",
  ],
  CONSTRUCTION: [
    "Terrain / Parcelle", "Bâtiment principal", "Annexes",
  ],
  REHABILITATION: [
    "Entrée / Couloir", "Pièce principale", "Cuisine",
    "Salle de bain", "WC", "Parties communes",
  ],
  BRS: [
    "Entrée / Couloir", "Salon / Séjour", "Cuisine", "Chambre 1",
    "Salle de bain", "WC",
  ],
  RURAL: [
    "Habitation — Entrée", "Habitation — Cuisine", "Habitation — Séjour",
    "Habitation — Chambre", "Habitation — Sanitaires",
    "Bâtiment agricole 1", "Bâtiment agricole 2",
    "Terrain / Parcelle",
  ],
};

const DEFAULT_ROOMS = ["Entrée / Couloir", "Pièce principale"];

type Room = { name: string; condition: string; notes: string };

export default function NouvelleInspectionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [leaseType, setLeaseType] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([
    { name: "Entrée / Couloir", condition: "BON", notes: "" },
    { name: "Salon", condition: "BON", notes: "" },
  ]);
  const [templateApplied, setTemplateApplied] = useState(false);

  useEffect(() => {
    async function fetchLeaseType() {
      try {
        const res = await fetch(`/api/leases/${params.id}`);
        if (res.ok) {
          const json = await res.json() as { data: { leaseType: string } };
          setLeaseType(json.data.leaseType);
        }
      } catch { /* ignore */ }
    }
    void fetchLeaseType();
  }, [params.id]);

  function applyTemplate() {
    const template = ROOM_TEMPLATES[leaseType ?? ""] ?? DEFAULT_ROOMS;
    setRooms(template.map((name) => ({ name, condition: "BON", notes: "" })));
    setTemplateApplied(true);
  }

  function addRoom() {
    setRooms([...rooms, { name: "", condition: "BON", notes: "" }]);
  }

  function removeRoom(index: number) {
    setRooms(rooms.filter((_, i) => i !== index));
  }

  function updateRoom(index: number, field: keyof Room, value: string) {
    setRooms(rooms.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) return;

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createInspection(activeSociety.id, {
      leaseId: params.id,
      type: data.type as "ENTREE" | "SORTIE",
      performedAt: data.performedAt!,
      performedBy: data.performedBy || null,
      generalNotes: data.generalNotes || null,
      rooms: rooms
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name,
          condition: r.condition as "BON" | "USAGE_NORMAL" | "DEGRADE" | "TRES_DEGRADE",
          notes: r.notes || null,
        })),
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/baux/${params.id}/inspections/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/baux/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Nouvel état des lieux
          </h1>
          <p className="text-muted-foreground">Entrée ou sortie de locataire</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <NativeSelect
                  id="type"
                  name="type"
                  options={TYPE_OPTIONS}
                  defaultValue="ENTREE"
                  required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="performedAt">Date *</Label>
                <Input
                  id="performedAt"
                  name="performedAt"
                  type="date"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="performedBy">Réalisé par</Label>
              <Input
                id="performedBy"
                name="performedBy"
                placeholder="Nom de l'agent ou du prestataire"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="generalNotes">Notes générales</Label>
              <Textarea
                id="generalNotes"
                name="generalNotes"
                rows={3}
                placeholder="Observations générales sur le bien..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Pièces */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>État par pièce</CardTitle>
                <CardDescription>
                  {leaseType && !templateApplied
                    ? "Un modèle de pièces est disponible pour ce type de bail"
                    : `${rooms.length} pièce${rooms.length > 1 ? "s" : ""}`}
                </CardDescription>
              </div>
              {leaseType && !templateApplied && (
                <Button type="button" variant="outline" size="sm" onClick={applyTemplate}>
                  Appliquer le modèle
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {rooms.map((room, index) => (
              <div
                key={index}
                className="border rounded-md p-4 space-y-3 relative"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => removeRoom(index)}
                  disabled={rooms.length === 1}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <div className="grid gap-3 md:grid-cols-2 pr-8">
                  <div className="space-y-1">
                    <Label className="text-xs">Pièce *</Label>
                    <Input
                      value={room.name}
                      onChange={(e) => updateRoom(index, "name", e.target.value)}
                      placeholder="Ex: Salon, Chambre 1..."
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">État</Label>
                    <select
                      value={room.condition}
                      onChange={(e) => updateRoom(index, "condition", e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {CONDITION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observations</Label>
                  <Textarea
                    value={room.notes}
                    onChange={(e) => updateRoom(index, "notes", e.target.value)}
                    rows={2}
                    placeholder="Détails, défauts constatés..."
                  />
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addRoom}>
              <Plus className="h-4 w-4" />
              Ajouter une pièce
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/baux/${params.id}`}>
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              "Créer l'état des lieux"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
