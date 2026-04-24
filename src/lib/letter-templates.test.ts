import { describe, it, expect } from "vitest";
import {
  LETTER_CATEGORIES,
  BUILTIN_TEMPLATES,
  interpolateTemplate,
} from "./letter-templates";

describe("LETTER_CATEGORIES", () => {
  it("contient 6 catégories", () => {
    expect(LETTER_CATEGORIES).toHaveLength(6);
  });

  it("contient la catégorie loyer et bail", () => {
    const values = LETTER_CATEGORIES.map((c) => c.value);
    expect(values).toContain("loyer");
    expect(values).toContain("bail");
  });

  it("chaque catégorie a value, label et description", () => {
    for (const cat of LETTER_CATEGORIES) {
      expect(cat.value).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.description).toBeTruthy();
    }
  });
});

describe("BUILTIN_TEMPLATES", () => {
  it("contient au moins 5 modèles prédéfinis", () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it("chaque modèle a les champs obligatoires", () => {
    for (const tpl of BUILTIN_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.name).toBeTruthy();
      expect(tpl.category).toBeTruthy();
      expect(tpl.subject).toBeTruthy();
      expect(tpl.bodyHtml).toBeTruthy();
      expect(Array.isArray(tpl.variables)).toBe(true);
    }
  });

  it("les IDs sont uniques", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("toutes les catégories référencées existent dans LETTER_CATEGORIES", () => {
    const validCategories = LETTER_CATEGORIES.map((c) => c.value);
    for (const tpl of BUILTIN_TEMPLATES) {
      expect(validCategories).toContain(tpl.category);
    }
  });

  it("contient un modèle de quittance de loyer", () => {
    expect(BUILTIN_TEMPLATES.some((t) => t.id.includes("quittance") || t.name.toLowerCase().includes("quittance"))).toBe(true);
  });

  it("les variables requises ont un type valide", () => {
    const validTypes = ["text", "date", "currency", "number", "textarea"];
    for (const tpl of BUILTIN_TEMPLATES) {
      for (const v of tpl.variables) {
        expect(validTypes).toContain(v.type);
      }
    }
  });
});

describe("interpolateTemplate", () => {
  it("remplace une variable simple", () => {
    const result = interpolateTemplate("Bonjour {{NOM}}", { NOM: "Alice" });
    expect(result).toBe("Bonjour Alice");
  });

  it("remplace plusieurs variables", () => {
    const result = interpolateTemplate("Bonjour {{NOM}}, votre loyer est {{LOYER}} €.", {
      NOM: "Alice",
      LOYER: "850",
    });
    expect(result).toBe("Bonjour Alice, votre loyer est 850 €.");
  });

  it("remplace toutes les occurrences d'une même variable", () => {
    const result = interpolateTemplate("{{NOM}} est {{NOM}}", { NOM: "Bob" });
    expect(result).toBe("Bob est Bob");
  });

  it("laisse intact les variables non fournies", () => {
    const result = interpolateTemplate("Bonjour {{NOM}}", {});
    expect(result).toBe("Bonjour {{NOM}}");
  });

  it("retourne le texte inchangé si aucune variable", () => {
    const result = interpolateTemplate("<p>Texte brut.</p>", {});
    expect(result).toBe("<p>Texte brut.</p>");
  });

  it("gère les variables avec underscore", () => {
    const result = interpolateTemplate("{{BAILLEUR_NOM}} - {{LOCATAIRE_NOM}}", {
      BAILLEUR_NOM: "SCI Les Pins",
      LOCATAIRE_NOM: "Dupont",
    });
    expect(result).toBe("SCI Les Pins - Dupont");
  });

  it("remplace dans un HTML complet", () => {
    const html = "<p>Le bailleur <strong>{{BAILLEUR}}</strong> informe {{LOCATAIRE}}.</p>";
    const result = interpolateTemplate(html, { BAILLEUR: "SCI", LOCATAIRE: "M. Martin" });
    expect(result).toBe("<p>Le bailleur <strong>SCI</strong> informe M. Martin.</p>");
  });
});
