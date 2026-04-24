// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BarChart2 } from "lucide-react";
import {
  loadDashboardLayout,
  saveDashboardLayout,
  WidgetConfigurator,
  WidgetWrapper,
  type DashboardWidget,
} from "./widget-configurator";

const STORAGE_KEY = "mygestia-dashboard-layout";

function makeWidget(overrides: Partial<DashboardWidget> = {}): DashboardWidget {
  return {
    id: "w1",
    label: "Widget Test",
    icon: BarChart2,
    size: "md",
    visible: true,
    order: 0,
    ...overrides,
  };
}

describe("loadDashboardLayout", () => {
  beforeEach(() => localStorage.clear());

  it("retourne les defaults si aucune donnée en localStorage", () => {
    const defaults = [makeWidget()];
    expect(loadDashboardLayout(defaults)).toEqual(defaults);
  });

  it("fusionne le localStorage avec les defaults (visible/order uniquement)", () => {
    const defaults = [makeWidget({ id: "w1", label: "Widget 1" }), makeWidget({ id: "w2", label: "Widget 2", order: 1 })];
    const stored = [{ id: "w1", visible: false, order: 5 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const result = loadDashboardLayout(defaults);
    const w1 = result.find((w) => w.id === "w1")!;
    expect(w1.visible).toBe(false);
    expect(w1.label).toBe("Widget 1");
  });

  it("garde les defaults pour un widget absent du localStorage", () => {
    const defaults = [makeWidget({ id: "nouveau", visible: true })];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: "ancien", visible: false, order: 0 }]));
    const result = loadDashboardLayout(defaults);
    expect(result[0].id).toBe("nouveau");
    expect(result[0].visible).toBe(true);
  });

  it("retourne les defaults si le JSON est invalide", () => {
    localStorage.setItem(STORAGE_KEY, "invalid json{{{");
    const defaults = [makeWidget()];
    expect(loadDashboardLayout(defaults)).toEqual(defaults);
  });

  it("trie par order après fusion", () => {
    const defaults = [makeWidget({ id: "a", order: 0 }), makeWidget({ id: "b", order: 1 })];
    const stored = [
      { id: "a", visible: true, order: 10 },
      { id: "b", visible: true, order: 0 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const result = loadDashboardLayout(defaults);
    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe("a");
  });
});

describe("saveDashboardLayout", () => {
  beforeEach(() => localStorage.clear());

  it("sérialise les widgets dans le localStorage", () => {
    const widgets = [makeWidget({ id: "x", visible: false })];
    saveDashboardLayout(widgets);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[0].id).toBe("x");
    expect(stored[0].visible).toBe(false);
  });
});

describe("WidgetWrapper", () => {
  it("rend les enfants quand visible=true", () => {
    render(
      <WidgetWrapper widget={makeWidget({ visible: true })}>
        <span>contenu</span>
      </WidgetWrapper>
    );
    expect(screen.getByText("contenu")).toBeInTheDocument();
  });

  it("ne rend rien quand visible=false", () => {
    const { container } = render(
      <WidgetWrapper widget={makeWidget({ visible: false })}>
        <span>contenu</span>
      </WidgetWrapper>
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("WidgetConfigurator", () => {
  beforeEach(() => localStorage.clear());

  it('affiche le bouton "Personnaliser" par défaut (panel fermé)', () => {
    render(<WidgetConfigurator widgets={[makeWidget()]} onUpdate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /personnaliser/i })).toBeInTheDocument();
    expect(screen.queryByText("Widgets du tableau de bord")).not.toBeInTheDocument();
  });

  it("ouvre le panel au clic sur Personnaliser", () => {
    render(<WidgetConfigurator widgets={[makeWidget()]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /personnaliser/i }));
    expect(screen.getByText("Widgets du tableau de bord")).toBeInTheDocument();
  });

  it("ferme le panel au clic sur X", () => {
    render(<WidgetConfigurator widgets={[makeWidget()]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /personnaliser/i }));
    // Plusieurs boutons sans nom accessible — on prend le premier (bouton X dans le header)
    const closeBtn = screen.getAllByRole("button", { name: "" })[0];
    fireEvent.click(closeBtn);
    expect(screen.queryByText("Widgets du tableau de bord")).not.toBeInTheDocument();
  });

  it("affiche le label du widget dans le panel", () => {
    render(<WidgetConfigurator widgets={[makeWidget({ label: "Mon Widget" })]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /personnaliser/i }));
    expect(screen.getByText("Mon Widget")).toBeInTheDocument();
  });

  it("appelle onUpdate avec visible inversé au clic sur l'icône œil", () => {
    const onUpdate = vi.fn();
    const widget = makeWidget({ id: "w1", visible: true });
    render(<WidgetConfigurator widgets={[widget]} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: /personnaliser/i }));
    // L'icône Eye est dans un button sans texte — on cherche le bouton eye
    const eyeBtn = document.querySelector("button[class*='text-muted']") as HTMLButtonElement;
    fireEvent.click(eyeBtn);
    expect(onUpdate).toHaveBeenCalledWith([{ ...widget, visible: false }]);
  });

  it("réinitialise la disposition et appelle onUpdate avec tous visible=true", () => {
    const onUpdate = vi.fn();
    const widgets = [
      makeWidget({ id: "a", visible: false, order: 1 }),
      makeWidget({ id: "b", visible: true, order: 0 }),
    ];
    render(<WidgetConfigurator widgets={widgets} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: /personnaliser/i }));
    fireEvent.click(screen.getByRole("button", { name: /réinitialiser/i }));
    const called = onUpdate.mock.calls[0][0] as DashboardWidget[];
    expect(called.every((w) => w.visible)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ferme le panel au clic sur l'overlay", () => {
    render(<WidgetConfigurator widgets={[makeWidget()]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /personnaliser/i }));
    expect(screen.getByText("Widgets du tableau de bord")).toBeInTheDocument();
    const overlay = document.querySelector(".fixed.inset-0.z-\\[55\\]") as HTMLElement;
    fireEvent.click(overlay);
    expect(screen.queryByText("Widgets du tableau de bord")).not.toBeInTheDocument();
  });
});
