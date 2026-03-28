"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { getDataroomsForDocument, addDocumentToDataroom } from "@/actions/dataroom";

type DataroomOption = { id: string; name: string; status: string };

export function AddToDataroomButton({ societyId, documentId }: { societyId: string; documentId: string }) {
  
  const [open, setOpen] = useState(false);
  const [datarooms, setDatarooms] = useState<DataroomOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && !loaded) {
      getDataroomsForDocument(societyId).then((items) => {
        setDatarooms(items);
        setLoaded(true);
      });
    }
  }, [open, loaded, societyId]);

  function handleAdd() {
    if (!selectedId) return;
    startTransition(async () => {
      const result = await addDocumentToDataroom(societyId, selectedId, documentId);
      if (result.success) {
        toast.success("Document ajoute a la dataroom");
        setOpen(false);
        setSelectedId("");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Ajouter a une dataroom">
          <Share2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter a une dataroom</DialogTitle>
          <DialogDescription>Selectionnez la dataroom dans laquelle ajouter ce document.</DialogDescription>
        </DialogHeader>
        <div>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger><SelectValue placeholder="Choisir une dataroom..." /></SelectTrigger>
            <SelectContent>
              {datarooms.map((dr) => (
                <SelectItem key={dr.id} value={dr.id}>
                  {dr.name} ({dr.status === "ACTIF" ? "Actif" : "Brouillon"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loaded && datarooms.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">Aucune dataroom disponible. Creez-en une depuis le menu Datarooms.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleAdd} disabled={pending || !selectedId}>
            {pending ? "Ajout..." : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
