"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface Props {
  currentSearch?: string;
  currentStatus?: string;
}

const STATUSES = [
  { value: "", label: "Tous les statuts" },
  { value: "PENDING_REVIEW", label: "À valider" },
  { value: "VALIDATED", label: "Validée" },
  { value: "REJECTED", label: "Rejetée" },
  { value: "PAID", label: "Payée" },
  { value: "ARCHIVED", label: "Archivée" },
];

export function SupplierInvoicesFilters({ currentSearch, currentStatus }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createQueryString = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.delete("page");
      return params.toString();
    },
    [searchParams]
  );

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const search = (form.elements.namedItem("search") as HTMLInputElement).value;
    router.push(`${pathname}?${createQueryString({ search: search || undefined })}`);
  }

  function handleStatusChange(status: string) {
    router.push(`${pathname}?${createQueryString({ status: status || undefined })}`);
  }

  function handleClear() {
    router.push(pathname);
  }

  const hasFilters = !!currentSearch || !!currentStatus;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Recherche */}
      <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            name="search"
            defaultValue={currentSearch}
            placeholder="Fournisseur, n° facture…"
            className="pl-9 h-9"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Rechercher
        </Button>
      </form>

      {/* Filtres statut */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => handleStatusChange(s.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              (currentStatus ?? "") === s.value
                ? "bg-[var(--color-brand-deep)] text-white border-[var(--color-brand-deep)]"
                : "bg-white text-muted-foreground border-border hover:border-[var(--color-brand-blue)] hover:text-[var(--color-brand-deep)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Reset filtres */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="gap-1.5 text-muted-foreground h-8"
        >
          <X className="h-3.5 w-3.5" />
          Effacer
        </Button>
      )}
    </div>
  );
}
