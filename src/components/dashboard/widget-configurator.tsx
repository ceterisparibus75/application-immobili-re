"use client";

import { useState, useCallback, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Settings2, GripVertical, Eye, EyeOff, RotateCcw, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DashboardWidget {
  id: string;
  label: string;
  icon: React.ElementType;
  size: "sm" | "md" | "lg" | "full";
  visible: boolean;
  order: number;
}

interface WidgetConfiguratorProps {
  widgets: DashboardWidget[];
  onUpdate: (widgets: DashboardWidget[]) => void;
}

const STORAGE_KEY = "mygestia-dashboard-layout";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function loadDashboardLayout(defaults: DashboardWidget[]): DashboardWidget[] {
  if (typeof window === "undefined") return defaults;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaults;
    const saved = JSON.parse(stored) as DashboardWidget[];
    // Merge avec les defaults pour les nouveaux widgets
    const savedMap = new Map(saved.map((w) => [w.id, w]));
    return defaults
      .map((d) => {
        const s = savedMap.get(d.id);
        return s ? { ...d, visible: s.visible, order: s.order } : d;
      })
      .sort((a, b) => a.order - b.order);
  } catch {
    return defaults;
  }
}

export function saveDashboardLayout(widgets: DashboardWidget[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}

/* ------------------------------------------------------------------ */
/*  Configurator panel                                                 */
/* ------------------------------------------------------------------ */

export function WidgetConfigurator({ widgets, onUpdate }: WidgetConfiguratorProps) {
  const [open, setOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const toggle = useCallback((id: string) => {
    const updated = widgets.map((w) =>
      w.id === id ? { ...w, visible: !w.visible } : w
    );
    onUpdate(updated);
    saveDashboardLayout(updated);
  }, [widgets, onUpdate]);

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...widgets];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    const withOrder = reordered.map((w, i) => ({ ...w, order: i }));
    onUpdate(withOrder);
    setDragIdx(idx);
  };

  const handleDragEnd = () => {
    saveDashboardLayout(widgets);
    setDragIdx(null);
  };

  const resetLayout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const reset = widgets.map((w, i) => ({ ...w, visible: true, order: i }));
    onUpdate(reset);
  }, [widgets, onUpdate]);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="h-3.5 w-3.5" />
        Personnaliser
      </Button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-black/20" onClick={() => setOpen(false)} />
      <div className="fixed right-4 top-20 z-[55] w-80 rounded-2xl border border-border/40 bg-card shadow-2xl animate-slide-in-left overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Widgets du tableau de bord</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {widgets.map((widget, idx) => {
            const Icon = widget.icon;
            return (
              <div
                key={widget.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                  dragIdx === idx ? "bg-primary/10" : "hover:bg-accent/50",
                  !widget.visible && "opacity-50",
                )}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab shrink-0" />
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm truncate">{widget.label}</span>
                <button
                  onClick={() => toggle(widget.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {widget.visible ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t px-4 py-2.5">
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 text-muted-foreground" onClick={resetLayout}>
            <RotateCcw className="h-3 w-3" />
            Réinitialiser la disposition
          </Button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Widget wrapper                                                     */
/* ------------------------------------------------------------------ */

interface WidgetWrapperProps {
  widget: DashboardWidget;
  children: ReactNode;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "col-span-1",
  md: "col-span-1 lg:col-span-2",
  lg: "col-span-1 lg:col-span-2 xl:col-span-3",
  full: "col-span-full",
};

export function WidgetWrapper({ widget, children }: WidgetWrapperProps) {
  if (!widget.visible) return null;

  return (
    <div className={cn(SIZE_CLASSES[widget.size] ?? "col-span-1", "animate-fade-in")}>
      {children}
    </div>
  );
}
