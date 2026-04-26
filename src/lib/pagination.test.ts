import { describe, it, expect } from "vitest";
import { parsePaginationParams, buildPrismaArgs, paginateResult } from "./pagination";

describe("parsePaginationParams", () => {
  it("retourne les valeurs par défaut si aucun paramètre fourni", () => {
    const result = parsePaginationParams({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.search).toBeUndefined();
    expect(result.sortBy).toBeUndefined();
    expect(result.sortOrder).toBe("asc");
    expect(result.filters).toEqual({});
  });

  it("parse correctement page et pageSize", () => {
    const result = parsePaginationParams({ page: "3", pageSize: "50" });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it("force page minimum à 1 si valeur < 1", () => {
    expect(parsePaginationParams({ page: "0" }).page).toBe(1);
    expect(parsePaginationParams({ page: "-5" }).page).toBe(1);
  });

  it("plafonne pageSize à 100", () => {
    expect(parsePaginationParams({ pageSize: "500" }).pageSize).toBe(100);
  });

  it("pageSize=0 tombe dans le fallback DEFAULT_PAGE_SIZE (25)", () => {
    // parseInt("0") = 0, falsy → || DEFAULT_PAGE_SIZE → 25
    expect(parsePaginationParams({ pageSize: "0" }).pageSize).toBe(25);
  });

  it("utilise 25 comme pageSize par défaut si valeur invalide", () => {
    expect(parsePaginationParams({ pageSize: "abc" }).pageSize).toBe(25);
  });

  it("utilise 1 comme page par défaut si valeur invalide", () => {
    expect(parsePaginationParams({ page: "abc" }).page).toBe(1);
  });

  it("trim le search — espaces seuls → chaîne vide", () => {
    // search.trim() retourne "" (la fonction ne filtre pas les chaînes vides après trim)
    expect(parsePaginationParams({ search: "  " }).search).toBe("");
  });

  it("trim le search avec contenu", () => {
    expect(parsePaginationParams({ search: "  martin  " }).search).toBe("martin");
  });

  it("parse sortBy et sortOrder", () => {
    const result = parsePaginationParams({ sortBy: "name", sortOrder: "desc" });
    expect(result.sortBy).toBe("name");
    expect(result.sortOrder).toBe("desc");
  });

  it("force sortOrder à asc si valeur invalide", () => {
    expect(parsePaginationParams({ sortOrder: "invalid" }).sortOrder).toBe("asc");
  });

  it("collecte les paramètres filter_*", () => {
    const result = parsePaginationParams({ filter_status: "ACTIVE", filter_type: "HABITATION", other: "ignored" });
    expect(result.filters).toEqual({ status: "ACTIVE", type: "HABITATION" });
  });

  it("ignore les filter_* avec valeur vide", () => {
    const result = parsePaginationParams({ filter_status: "" });
    expect(result.filters).toEqual({});
  });

  it("accepte les paramètres de type tableau (prend la valeur brute)", () => {
    const result = parsePaginationParams({ page: ["3", "5"] });
    expect(result.page).toBe(3);
  });
});

describe("buildPrismaArgs", () => {
  it("calcule skip et take correctement", () => {
    const args = buildPrismaArgs({ page: 2, pageSize: 25, sortOrder: "asc", filters: {} });
    expect(args.skip).toBe(25);
    expect(args.take).toBe(25);
  });

  it("page 1 → skip 0", () => {
    const args = buildPrismaArgs({ page: 1, pageSize: 10, sortOrder: "asc", filters: {} });
    expect(args.skip).toBe(0);
  });

  it("ajoute orderBy si sortBy est défini", () => {
    const args = buildPrismaArgs({ page: 1, pageSize: 10, sortBy: "createdAt", sortOrder: "desc", filters: {} });
    expect(args.orderBy).toEqual({ createdAt: "desc" });
  });

  it("utilise 'asc' par défaut si sortBy défini mais sortOrder absent → B11 arm1 L57", () => {
    const args = buildPrismaArgs({ page: 1, pageSize: 10, sortBy: "name", filters: {} });
    expect(args.orderBy).toEqual({ name: "asc" });
  });

  it("n'ajoute pas orderBy si sortBy est absent", () => {
    const args = buildPrismaArgs({ page: 1, pageSize: 10, sortOrder: "asc", filters: {} });
    expect(args.orderBy).toBeUndefined();
  });
});

describe("paginateResult", () => {
  it("calcule totalPages correctement", () => {
    const result = paginateResult([], 100, { page: 1, pageSize: 25, sortOrder: "asc", filters: {} });
    expect(result.totalPages).toBe(4);
  });

  it("arrondit totalPages à l'entier supérieur", () => {
    const result = paginateResult([], 11, { page: 1, pageSize: 5, sortOrder: "asc", filters: {} });
    expect(result.totalPages).toBe(3);
  });

  it("retourne les bonnes métadonnées de pagination", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = paginateResult(data, 50, { page: 3, pageSize: 10, sortOrder: "asc", filters: {} });
    expect(result.data).toBe(data);
    expect(result.total).toBe(50);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(5);
  });

  it("totalPages = 1 si total ≤ pageSize", () => {
    const result = paginateResult([], 5, { page: 1, pageSize: 25, sortOrder: "asc", filters: {} });
    expect(result.totalPages).toBe(1);
  });

  it("totalPages = 0 si total = 0", () => {
    const result = paginateResult([], 0, { page: 1, pageSize: 25, sortOrder: "asc", filters: {} });
    expect(result.totalPages).toBe(0);
  });
});
