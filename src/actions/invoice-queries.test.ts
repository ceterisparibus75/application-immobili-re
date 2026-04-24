import { describe, it, expect } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import {
  getInvoices,
  getInvoiceById,
  getActiveLeasesForInvoicing,
  getLeaseForInvoice,
} from "./invoice-queries";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const INVOICE_ID = "clh3x2z4k0001qh8g7z1y2v3t";
const LEASE_ID = "clh3x2z4k0002qh8g7z1y2v3t";

describe("getInvoices", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getInvoices(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne la liste des factures si authentifié", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.invoice.findMany.mockResolvedValue([{ id: INVOICE_ID }] as never);

    const result = await getInvoices(SOCIETY_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: INVOICE_ID });
  });
});

describe("getInvoiceById", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getInvoiceById(SOCIETY_ID, INVOICE_ID);
    expect(result).toBeNull();
  });

  it("retourne la facture si authentifié et trouvée", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue({ id: INVOICE_ID, societyId: SOCIETY_ID } as never);

    const result = await getInvoiceById(SOCIETY_ID, INVOICE_ID);
    expect(result).toMatchObject({ id: INVOICE_ID });
  });

  it("retourne null si la facture n'est pas trouvée", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await getInvoiceById(SOCIETY_ID, INVOICE_ID);
    expect(result).toBeNull();
  });
});

describe("getActiveLeasesForInvoicing", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getActiveLeasesForInvoicing(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne les baux actifs si authentifié", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.lease.findMany.mockResolvedValue([{ id: LEASE_ID }] as never);

    const result = await getActiveLeasesForInvoicing(SOCIETY_ID);
    expect(result).toHaveLength(1);
  });
});

describe("getLeaseForInvoice", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getLeaseForInvoice(SOCIETY_ID, LEASE_ID);
    expect(result).toBeNull();
  });

  it("retourne le bail si authentifié et trouvé", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockResolvedValue({ id: LEASE_ID } as never);

    const result = await getLeaseForInvoice(SOCIETY_ID, LEASE_ID);
    expect(result).toMatchObject({ id: LEASE_ID });
  });

  it("retourne null si le bail n'est pas trouvé", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockResolvedValue(null);

    const result = await getLeaseForInvoice(SOCIETY_ID, LEASE_ID);
    expect(result).toBeNull();
  });
});
