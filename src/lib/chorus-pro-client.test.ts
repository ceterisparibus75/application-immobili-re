import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/piste", () => ({
  getPisteToken: vi.fn().mockResolvedValue("piste-token-abc"),
  invalidatePisteToken: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    PISTE_CLIENT_ID: "client",
    PISTE_CLIENT_SECRET: "secret",
    CHORUS_PRO_TECH_ACCOUNT: "TECH_1@cpro.fr",
    CHORUS_PRO_TECH_PASSWORD: "pw",
    CHORUS_PRO_TECH_USER_ID: "42",
    CHORUS_PRO_ENV: "sandbox" as const,
  },
}));

import { getPisteToken, invalidatePisteToken } from "@/lib/piste";
import { env } from "@/lib/env";
import {
  ChorusProClient,
  ChorusProError,
  getChorusProClient,
  isChorusProConfigured,
} from "./chorus-pro-client";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(getPisteToken).mockClear().mockResolvedValue("piste-token-abc");
  vi.mocked(invalidatePisteToken).mockClear();
});

describe("isChorusProConfigured", () => {
  it("retourne true quand les 4 vars sont présentes", () => {
    expect(isChorusProConfigured()).toBe(true);
  });

  it("retourne false si une des 4 vars manque", () => {
    const original = env.CHORUS_PRO_TECH_PASSWORD;
    (env as Record<string, unknown>).CHORUS_PRO_TECH_PASSWORD = undefined;
    expect(isChorusProConfigured()).toBe(false);
    (env as Record<string, unknown>).CHORUS_PRO_TECH_PASSWORD = original;
  });
});

describe("ChorusProClient — construction", () => {
  it("lève si CHORUS_PRO_TECH_ACCOUNT manque", () => {
    const original = env.CHORUS_PRO_TECH_ACCOUNT;
    (env as Record<string, unknown>).CHORUS_PRO_TECH_ACCOUNT = undefined;
    expect(() => new ChorusProClient()).toThrow(/CHORUS_PRO_TECH_ACCOUNT/);
    (env as Record<string, unknown>).CHORUS_PRO_TECH_ACCOUNT = original;
  });

  it("encode cpro-account en base64 (compte:password)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ codeRetour: 0, libelle: "OK", numeroFluxDepot: "CPP123" }),
    );
    const client = new ChorusProClient();
    await client.deposerFluxFacture(Buffer.from("pdf"), "fac.pdf");

    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    const expected = Buffer.from("TECH_1@cpro.fr:pw").toString("base64");
    expect(headers["cpro-account"]).toBe(expected);
    expect(headers.Authorization).toBe("Bearer piste-token-abc");
  });

  it("parse CHORUS_PRO_TECH_USER_ID en number, fallback 0 si absent", async () => {
    const original = env.CHORUS_PRO_TECH_USER_ID;
    (env as Record<string, unknown>).CHORUS_PRO_TECH_USER_ID = undefined;

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ codeRetour: 0, libelle: "OK", numeroFluxDepot: "CPP" }),
    );
    const client = new ChorusProClient();
    await client.deposerFluxFacture(Buffer.from("pdf"), "fac.pdf");

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.idUtilisateurCourant).toBe(0);

    (env as Record<string, unknown>).CHORUS_PRO_TECH_USER_ID = original;
  });
});

describe("deposerFluxFacture", () => {
  it("envoie le fichier en base64 + nom + syntaxe Factur-X par défaut", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ codeRetour: 0, libelle: "OK", numeroFluxDepot: "CPP0021" }),
    );

    const client = new ChorusProClient();
    const buf = Buffer.from("hello-pdf");
    const result = await client.deposerFluxFacture(buf, "facture.pdf");

    expect(result.numeroFluxDepot).toBe("CPP0021");
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toContain("/deposerFluxFacture");
    const body = JSON.parse((call?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      idUtilisateurCourant: 42,
      fichierFlux: buf.toString("base64"),
      nomFichier: "facture.pdf",
      syntaxeFlux: "IN_DP_E1_FACTURX",
      avecSignature: false,
    });
  });

  it("respecte le paramètre syntax pour UBL", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ codeRetour: 0, libelle: "OK", numeroFluxDepot: "X" }),
    );
    const client = new ChorusProClient();
    await client.deposerFluxFacture(Buffer.from("x"), "f.xml", "IN_DP_E1_UBL_INVOICE");
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.syntaxeFlux).toBe("IN_DP_E1_UBL_INVOICE");
  });

  it("cible l'URL sandbox quand CHORUS_PRO_ENV=sandbox", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ codeRetour: 0, libelle: "OK", numeroFluxDepot: "X" }),
    );
    const client = new ChorusProClient();
    await client.deposerFluxFacture(Buffer.from("x"), "f.pdf");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://sandbox-api.piste.gouv.fr/cpro/factures/v1/deposerFluxFacture",
    );
  });

  it("cible l'URL production quand CHORUS_PRO_ENV=production", async () => {
    (env as Record<string, unknown>).CHORUS_PRO_ENV = "production";
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ codeRetour: 0, libelle: "OK", numeroFluxDepot: "X" }),
    );
    const client = new ChorusProClient();
    await client.deposerFluxFacture(Buffer.from("x"), "f.pdf");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.piste.gouv.fr/cpro/factures/v1/deposerFluxFacture",
    );
    (env as Record<string, unknown>).CHORUS_PRO_ENV = "sandbox";
  });
});

describe("gestion du token expiré (401)", () => {
  it("invalide le token et réessaie une fois sur 401", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse({ codeRetour: 0, libelle: "OK", numeroFluxDepot: "RETRY-OK" }),
      );

    const client = new ChorusProClient();
    const result = await client.deposerFluxFacture(Buffer.from("x"), "f.pdf");

    expect(invalidatePisteToken).toHaveBeenCalledTimes(1);
    expect(getPisteToken).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.numeroFluxDepot).toBe("RETRY-OK");
  });

  it("propage l'erreur si le retry échoue aussi (codeRetour non nul)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse({ codeRetour: 12, libelle: "Toujours invalide" }),
      );

    const client = new ChorusProClient();
    await expect(client.deposerFluxFacture(Buffer.from("x"), "f.pdf")).rejects.toBeInstanceOf(
      ChorusProError,
    );
  });
});

describe("ChorusProError", () => {
  it("lève une ChorusProError quand codeRetour ≠ 0", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ codeRetour: 9, libelle: "Service indisponible" }),
    );

    const client = new ChorusProClient();
    try {
      await client.deposerFluxFacture(Buffer.from("x"), "f.pdf");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ChorusProError);
      const cpe = err as ChorusProError;
      expect(cpe.codeRetour).toBe(9);
      expect(cpe.libelle).toBe("Service indisponible");
      expect(cpe.path).toBe("/deposerFluxFacture");
    }
  });

  it("lève une ChorusProError sur statut HTTP ≥ 400 sans codeRetour", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new ChorusProClient();
    await expect(client.consulterCR("CPP123")).rejects.toThrow(/500/);
  });
});

describe("consulterCR et recherche", () => {
  it("consulterCR envoie numeroFluxDepot + idUtilisateurCourant", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ codeRetour: 0, libelle: "OK", statutCR: "INTEGRE" }),
    );

    const client = new ChorusProClient();
    const result = await client.consulterCR("CPP-1");
    expect(result.statutCR).toBe("INTEGRE");
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toEqual({ idUtilisateurCourant: 42, numeroFluxDepot: "CPP-1" });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/consulterCR");
  });

  it("rechercherFactureParFournisseur défaute pageCourante=0 et nbResultatsParPage=50", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ codeRetour: 0, libelle: "OK", listeFacture: [] }),
    );
    const client = new ChorusProClient();
    await client.rechercherFactureParFournisseur({ dateDepotDebut: "2026-01-01" });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      idUtilisateurCourant: 42,
      dateDepotDebut: "2026-01-01",
      pageCourante: 0,
      nbResultatsParPage: 50,
    });
  });

  it("rechercherFactureParRecipiendaire pointe vers /rechercherFactureParRecipiendaire", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ codeRetour: 0, libelle: "OK", listeFacture: [] }),
    );
    const client = new ChorusProClient();
    await client.rechercherFactureParRecipiendaire({ page: 2, nbResultatsParPage: 10 });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/rechercherFactureParRecipiendaire");
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.pageCourante).toBe(2);
    expect(body.nbResultatsParPage).toBe(10);
  });
});

describe("getChorusProClient (singleton)", () => {
  it("retourne null si non configuré", () => {
    const original = env.PISTE_CLIENT_ID;
    (env as Record<string, unknown>).PISTE_CLIENT_ID = undefined;
    expect(getChorusProClient()).toBeNull();
    (env as Record<string, unknown>).PISTE_CLIENT_ID = original;
  });

  it("renvoie la même instance à chaque appel", () => {
    const a = getChorusProClient();
    const b = getChorusProClient();
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });
});
