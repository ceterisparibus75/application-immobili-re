export type ChargeAccountingCategory = {
  name?: string | null;
  nature?: string | null;
};

function normalizeCategoryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

export function getChargeAccountCodePrefixes(category?: ChargeAccountingCategory | null): string[] {
  if (!category?.name) return ["60"];

  const name = normalizeCategoryName(category.name);

  if (includesAny(name, ["teom", "ordures menageres"])) return ["6352", "614", "60"];
  if (includesAny(name, ["taxe fonciere"])) return ["6351", "635", "60"];
  if (includesAny(name, ["cfe", "contribution fonciere"])) return ["6353", "635", "60"];
  if (includesAny(name, ["taxe sur les bureaux"])) return ["635", "60"];
  if (includesAny(name, ["frais bancaires", "commission bancaire", "tenue de compte"])) return ["627", "60"];
  if (includesAny(name, ["interets d'emprunt", "interets emprunt"])) return ["6611", "661", "60"];
  if (includesAny(name, ["assurance", "pno", "gli", "emprunteur"])) return ["616", "60"];
  if (includesAny(name, ["honoraires", "syndic", "gestion locative", "comptable", "juridique", "contentieux", "diagnostics"])) {
    return ["622", "60"];
  }
  if (includesAny(name, ["eau", "electricite", "chauffage", "combustible", "energie", "assainissement"])) {
    return ["6061", "614", "60"];
  }
  if (includesAny(name, [
    "entretien",
    "nettoyage",
    "ascenseur",
    "vmc",
    "interphone",
    "digicode",
    "portail",
    "espaces verts",
    "ramonage",
    "deratisation",
    "desinsectisation",
  ])) {
    return ["6152", "6151", "614", "60"];
  }
  if (includesAny(name, ["copropriete", "appel de charges"])) return ["614", "60"];

  if (category.nature === "RECUPERABLE" || category.nature === "MIXTE") return ["614", "615", "606", "60"];
  return ["615", "622", "606", "635", "60"];
}
