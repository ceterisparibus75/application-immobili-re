"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Search,
  ArrowRight,
  Banknote,
  ScrollText,
  Receipt,
  Wrench,
  Shield,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { GestionLocativeNav } from "@/components/layout/gestion-locative-nav";
import { BUILTIN_TEMPLATES, LETTER_CATEGORIES } from "@/lib/letter-templates";
import type { LetterCategory } from "@/lib/letter-templates";

const CATEGORY_ICONS: Record<LetterCategory, typeof FileText> = {
  loyer: Banknote,
  bail: ScrollText,
  charges: Receipt,
  travaux: Wrench,
  assurance: Shield,
  administratif: FolderOpen,
};

export default function CourriersPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<LetterCategory | "all">("all");

  const filtered = BUILTIN_TEMPLATES.filter((t) => {
    const matchesCategory = activeCategory === "all" || t.category === activeCategory;
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedByCategory = LETTER_CATEGORIES.map((cat) => ({
    ...cat,
    templates: filtered.filter((t) => t.category === cat.value),
  })).filter((g) => g.templates.length > 0);

  return (
    <div className="space-y-6">
      <GestionLocativeNav />
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Courriers types</h1>
        <p className="text-muted-foreground">
          Bibliothèque de modèles de courriers conformes à la législation en vigueur
        </p>
      </div>

      {/* Recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un modèle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={activeCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory("all")}
          >
            Tous
          </Button>
          {LETTER_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.value];
            return (
              <Button
                key={cat.value}
                variant={activeCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(cat.value)}
                className="gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Résultats */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Aucun modèle trouvé</p>
            <p className="text-xs text-muted-foreground mt-1">
              Essayez avec d&apos;autres mots-clés ou changez de catégorie
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedByCategory.map((group) => {
            const Icon = CATEGORY_ICONS[group.value];
            return (
              <div key={group.value}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{group.label}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {group.templates.length}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.templates.map((template) => (
                    <Link key={template.id} href={`/courriers/${template.id}`}>
                      <Card className="h-full transition-colors hover:border-primary/50 hover:shadow-sm cursor-pointer">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                            {template.name}
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-2">
                            {template.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {template.variables.length} champ{template.variables.length > 1 ? "s" : ""}
                            </Badge>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
