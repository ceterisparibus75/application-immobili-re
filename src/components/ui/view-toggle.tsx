"use client";

import { LayoutGrid, LayoutList, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewMode = "table" | "cards" | "compact";
export type Density = "comfortable" | "compact" | "ultra-compact";

interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  availableViews?: ViewMode[];
}

interface DensityToggleProps {
  density: Density;
  onDensityChange: (density: Density) => void;
}

const VIEW_OPTIONS: { value: ViewMode; icon: React.ElementType; label: string }[] = [
  { value: "table", icon: LayoutList, label: "Tableau" },
  { value: "cards", icon: LayoutGrid, label: "Cartes" },
  { value: "compact", icon: Columns3, label: "Compact" },
];

const DENSITY_OPTIONS: { value: Density; label: string; lineHeight: string }[] = [
  { value: "comfortable", label: "Confortable", lineHeight: "py-3" },
  { value: "compact", label: "Compact", lineHeight: "py-2" },
  { value: "ultra-compact", label: "Ultra-compact", lineHeight: "py-1" },
];

export function ViewToggle({ view, onViewChange, availableViews }: ViewToggleProps) {
  const views = availableViews
    ? VIEW_OPTIONS.filter((v) => availableViews.includes(v.value))
    : VIEW_OPTIONS;

  return (
    <div className="flex items-center rounded-lg border border-border/50 p-0.5 bg-muted/30">
      {views.map((opt) => {
        const Icon = opt.icon;
        return (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 p-0",
              view === opt.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onViewChange(opt.value)}
            title={opt.label}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        );
      })}
    </div>
  );
}

export function DensityToggle({ density, onDensityChange }: DensityToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-border/50 p-0.5 bg-muted/30">
      {DENSITY_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-[10px]",
            density === opt.value ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onDensityChange(opt.value)}
          title={opt.label}
        >
          {opt.label.charAt(0).toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

/** Returns the Tailwind class for row padding based on density */
export function getDensityClass(density: Density): string {
  return DENSITY_OPTIONS.find((d) => d.value === density)?.lineHeight ?? "py-3";
}
