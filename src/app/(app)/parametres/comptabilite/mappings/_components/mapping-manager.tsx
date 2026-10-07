"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteMapping,
  seedDefaultMappings,
  upsertMapping,
  type AccountingCategoryMappingDTO,
} from "@/actions/accounting-category-mapping";

type Props = {
  societyId: string;
  initialMappings: AccountingCategoryMappingDTO[];
  cashflowCategories: Array<{ id: string; label: string }>;
};

type EditorState = {
  open: boolean;
  mode: "cashflow" | "keyword";
  id?: string;
  cashflowCategoryId: string;
  keyword: string;
  accountCode: string;
  accountLabel: string;
  notes: string;
};

const EMPTY_EDITOR: EditorState = {
  open: false,
  mode: "cashflow",
  id: undefined,
  cashflowCategoryId: "",
  keyword: "",
  accountCode: "",
  accountLabel: "",
  notes: "",
};

export function MappingManager({ societyId, initialMappings, cashflowCategories }: Props) {
  const [mappings, setMappings] = useState(initialMappings);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSeeding, startSeedTransition] = useTransition();

  const labelForCategory = (id: string | null) =>
    cashflowCategories.find((c) => c.id === id)?.label ?? id ?? "—";

  function openCreate(mode: "cashflow" | "keyword") {
    setEditor({ ...EMPTY_EDITOR, mode, open: true });
  }

  function openEdit(row: AccountingCategoryMappingDTO) {
    setEditor({
      open: true,
      mode: row.cashflowCategoryId ? "cashflow" : "keyword",
      id: row.id,
      cashflowCategoryId: row.cashflowCategoryId ?? "",
      keyword: row.keyword ?? "",
      accountCode: row.accountCode,
      accountLabel: row.accountLabel ?? "",
      notes: row.notes ?? "",
    });
  }

  async function refresh() {
    // Simple reload : au prochain render Server le listMappings sera relu.
    // On met à jour en optimistic côté client pour l'UX immédiate.
  }

  function handleSave() {
    startTransition(async () => {
      const payload = {
        id: editor.id,
        cashflowCategoryId:
          editor.mode === "cashflow" ? editor.cashflowCategoryId.trim() || null : null,
        keyword:
          editor.mode === "keyword" ? editor.keyword.trim() || null : null,
        accountCode: editor.accountCode.trim(),
        accountLabel: editor.accountLabel.trim() || null,
        notes: editor.notes.trim() || null,
      };

      const res = await upsertMapping(societyId, payload);
      if (!res.success) {
        toast.error(res.error ?? "Impossible d'enregistrer le mapping");
        return;
      }
      toast.success("Mapping enregistré");
      setEditor(EMPTY_EDITOR);
      await refresh();
      // Rechargement forcé pour relire listMappings.
      window.location.reload();
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const res = await deleteMapping(societyId, deleteId);
      if (!res.success) {
        toast.error(res.error ?? "Impossible de supprimer");
        return;
      }
      toast.success("Mapping supprimé");
      setMappings((prev) => prev.filter((m) => m.id !== deleteId));
      setDeleteId(null);
    });
  }

  function handleSeed() {
    startSeedTransition(async () => {
      const res = await seedDefaultMappings(societyId);
      if (!res.success) {
        toast.error(res.error ?? "Impossible d'initialiser les mappings");
        return;
      }
      toast.success(`${res.data?.created ?? 0} mappings par défaut créés`);
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => openCreate("cashflow")}>
          <Plus className="h-4 w-4" />
          Ajouter (par catégorie)
        </Button>
        <Button size="sm" variant="outline" onClick={() => openCreate("keyword")}>
          <Plus className="h-4 w-4" />
          Ajouter (par mot-clé)
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSeed}
          disabled={isSeeding}
        >
          {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Initialiser avec les valeurs par défaut
        </Button>
      </div>

      {mappings.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun mapping personnalisé. Les codes PCG par défaut sont utilisés.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Clé</TableHead>
                <TableHead>Code PCG</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.cashflowCategoryId ? (
                      <Badge variant="default">Catégorie</Badge>
                    ) : (
                      <Badge variant="outline">Mot-clé</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.cashflowCategoryId
                      ? labelForCategory(row.cashflowCategoryId)
                      : row.keyword}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{row.accountCode}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.accountLabel ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(row)}
                        aria-label="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteId(row.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog upsert */}
      <Dialog
        open={editor.open}
        onOpenChange={(open) => (open ? null : setEditor(EMPTY_EDITOR))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor.id ? "Modifier le mapping" : "Ajouter un mapping"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editor.mode === "cashflow" ? (
              <div className="space-y-2">
                <Label htmlFor="cashflowCategoryId">Catégorie cashflow</Label>
                <select
                  id="cashflowCategoryId"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={editor.cashflowCategoryId}
                  onChange={(e) =>
                    setEditor((s) => ({ ...s, cashflowCategoryId: e.target.value }))
                  }
                >
                  <option value="">— Choisir —</option>
                  {cashflowCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="keyword">Mot-clé</Label>
                <Input
                  id="keyword"
                  value={editor.keyword}
                  onChange={(e) => setEditor((s) => ({ ...s, keyword: e.target.value }))}
                  placeholder="Ex: ELECTRICITE"
                />
                <p className="text-xs text-muted-foreground">
                  Match insensible à la casse et aux accents dans le nom de la catégorie de charge.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="accountCode">Code PCG</Label>
                <Input
                  id="accountCode"
                  value={editor.accountCode}
                  onChange={(e) =>
                    setEditor((s) => ({ ...s, accountCode: e.target.value }))
                  }
                  placeholder="606100"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountLabel">Libellé (optionnel)</Label>
                <Input
                  id="accountLabel"
                  value={editor.accountLabel}
                  onChange={(e) =>
                    setEditor((s) => ({ ...s, accountLabel: e.target.value }))
                  }
                  placeholder="Énergie - eau"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                value={editor.notes}
                onChange={(e) => setEditor((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Pour mémo interne"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>
                Annuler
              </Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => (open ? null : setDeleteId(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce mapping ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les prochaines transactions concernées retomberont sur le code PCG hard-codé par défaut.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
