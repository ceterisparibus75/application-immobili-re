import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { requireActiveSocietyRouteContext } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({
  requireActiveSocietyRouteContext,
}));

import { GET } from "./route";

describe("GET /api/search", () => {
  beforeEach(() => {
    requireActiveSocietyRouteContext.mockReset();
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: "society-1",
      userId: "user-1",
    });
  });

  it("renvoie des liens profonds vers les documents trouves", async () => {
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: "doc 1/2",
        fileName: "Bail commercial.pdf",
        category: "lease",
        description: "Bail signe",
      },
    ] as never);

    const response = await GET(
      new Request("http://localhost/api/search?q=bail&type=document") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      {
        id: "doc 1/2",
        type: "document",
        title: "Bail commercial.pdf",
        subtitle: "lease",
        href: "/documents?documentId=doc%201%2F2",
      },
    ]);
    expect(prismaMock.document.findMany).toHaveBeenCalledWith({
      where: {
        societyId: "society-1",
        OR: [
          { fileName: { contains: "bail", mode: "insensitive" } },
          { description: { contains: "bail", mode: "insensitive" } },
          { category: { contains: "bail", mode: "insensitive" } },
        ],
      },
      take: 3,
      select: { id: true, fileName: true, category: true, description: true },
    });
  });

  it("retrouve un compte bancaire avec solde et lien profond", async () => {
    prismaMock.bankAccount.findMany.mockResolvedValue([
      {
        id: "bank-1",
        accountName: "Compte LCL exploitation",
        bankName: "LCL",
        currentBalance: 1234.56,
      },
    ] as never);

    const response = await GET(
      new Request("http://localhost/api/search?q=lcl&type=bankAccount") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      {
        id: "bank-1",
        type: "bankAccount",
        title: "Compte LCL exploitation",
        subtitle: "LCL",
        href: "/banque/bank-1",
        meta: "1\u202f234,56\u00a0€",
      },
    ]);
    expect(prismaMock.bankAccount.findMany).toHaveBeenCalledWith({
      where: {
        societyId: "society-1",
        OR: [
          { accountName: { contains: "lcl", mode: "insensitive" } },
          { bankName: { contains: "lcl", mode: "insensitive" } },
        ],
      },
      take: 3,
      select: {
        id: true,
        accountName: true,
        bankName: true,
        currentBalance: true,
      },
    });
  });

  it("retrouve les tickets locataires par sujet et locataire", async () => {
    prismaMock.ticket.findMany.mockResolvedValue([
      {
        id: "ticket-1",
        ticketNumber: "TK-2026-0001",
        subject: "Fuite salle de bain",
        status: "OUVERT",
        priority: "HAUTE",
        tenant: { companyName: null, firstName: "Alice", lastName: "Martin" },
      },
    ] as never);

    const response = await GET(
      new Request("http://localhost/api/search?q=fuite&type=ticket") as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      {
        id: "ticket-1",
        type: "ticket",
        title: "TK-2026-0001 - Fuite salle de bain",
        subtitle: "Alice Martin",
        href: "/tickets/ticket-1",
        meta: "OUVERT",
      },
    ]);
  });
});
