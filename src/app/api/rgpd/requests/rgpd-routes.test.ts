import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { prismaMock } from "@/test/mocks/prisma";

const {
  requireActiveSocietyRouteContext,
  createAuditLog,
  exportTenantData,
} = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  createAuditLog: vi.fn(),
  exportTenantData: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({
  requireActiveSocietyRouteContext,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog,
}));

vi.mock("@/lib/rgpd-export", () => ({
  exportTenantData,
}));

import { GET as listRequests, POST as createRequest } from "./route";
import { GET as exportRequest } from "./[id]/export/route";
import { POST as processRequest } from "./[id]/process/route";

const SOCIETY_CONTEXT = {
  societyId: "society-1",
  userId: "user-1",
};

describe("RGPD routes", () => {
  beforeEach(() => {
    vi.useRealTimers();
    requireActiveSocietyRouteContext.mockReset();
    createAuditLog.mockReset();
    createAuditLog.mockResolvedValue(undefined);
    exportTenantData.mockReset();
    requireActiveSocietyRouteContext.mockResolvedValue(SOCIETY_CONTEXT);
  });

  describe("GET /api/rgpd/requests", () => {
    it("retourne les 50 dernières demandes de la société", async () => {
      prismaMock.gdprRequest.findMany.mockResolvedValue([
        { id: "req-1", requesterEmail: "a@example.com" },
      ] as never);

      const response = await listRequests();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual([{ id: "req-1", requesterEmail: "a@example.com" }]);
      expect(prismaMock.gdprRequest.findMany).toHaveBeenCalledWith({
        where: { societyId: "society-1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    });

    it("retourne 401 si le contexte société n'est pas disponible", async () => {
      requireActiveSocietyRouteContext.mockResolvedValue(
        NextResponse.json({ error: "Non authentifié" }, { status: 401 })
      );

      const response = await listRequests();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toEqual({ error: "Non authentifié" });
    });
  });

  describe("POST /api/rgpd/requests", () => {
    it("crée une demande valide", async () => {
      prismaMock.gdprRequest.create.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requesterName: "Alice Durand",
        requesterEmail: "alice@example.com",
        requestType: "access",
        notes: "Merci",
        status: "pending",
      } as never);

      const request = new Request("http://localhost/api/rgpd/requests", {
        method: "POST",
        body: JSON.stringify({
          requesterName: "Alice Durand",
          requesterEmail: "alice@example.com",
          requestType: "access",
          notes: "Merci",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await createRequest(request as never);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.id).toBe("req-1");
      expect(prismaMock.gdprRequest.create).toHaveBeenCalledWith({
        data: {
          societyId: "society-1",
          requesterName: "Alice Durand",
          requesterEmail: "alice@example.com",
          requestType: "access",
          notes: "Merci",
          status: "pending",
        },
      });
    });

    it("retourne 400 si le payload est invalide", async () => {
      const request = new Request("http://localhost/api/rgpd/requests", {
        method: "POST",
        body: JSON.stringify({
          requesterName: "",
          requesterEmail: "not-an-email",
          requestType: "access",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await createRequest(request as never);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain("Le nom est requis");
      expect(body.error).toContain("Email invalide");
    });
  });

  describe("GET /api/rgpd/requests/[id]/export", () => {
    it("retourne 404 si la demande n'existe pas", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue(null);

      const response = await exportRequest({} as never, {
        params: Promise.resolve({ id: "req-missing" }),
      });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({ error: "Demande introuvable" });
    });

    it("retourne 400 si le type n'est pas exportable", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requestType: "deletion",
        requesterEmail: "alice@example.com",
      } as never);

      const response = await exportRequest({} as never, {
        params: Promise.resolve({ id: "req-1" }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain("acces");
    });

    it("retourne le JSON d'export et crée un audit log", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-20T12:00:00.000Z"));

      prismaMock.gdprRequest.findFirst.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requestType: "access",
        requesterEmail: "alice@example.com",
      } as never);
      exportTenantData.mockResolvedValue({
        exportDate: "2026-04-20T12:00:00.000Z",
        societyId: "society-1",
        requesterEmail: "alice@example.com",
        tenants: [],
      });

      const response = await exportRequest({} as never, {
        params: Promise.resolve({ id: "req-1" }),
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Disposition")).toContain(
        "rgpd-export-alice_example_com-2026-04-20.json"
      );
      expect(JSON.parse(body)).toEqual({
        exportDate: "2026-04-20T12:00:00.000Z",
        societyId: "society-1",
        requesterEmail: "alice@example.com",
        tenants: [],
      });
      expect(createAuditLog).toHaveBeenCalledWith({
        societyId: "society-1",
        userId: "user-1",
        action: "EXPORT",
        entity: "GdprRequest",
        entityId: "req-1",
        details: {
          type: "access",
          email: "alice@example.com",
        },
      });

      vi.useRealTimers();
    });
  });

  describe("POST /api/rgpd/requests/[id]/process", () => {
    it("retourne 404 si la demande pending n'existe pas", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue(null);

      const request = new Request("http://localhost/api/rgpd/requests/req-missing/process", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await processRequest(request as never, {
        params: Promise.resolve({ id: "req-missing" }),
      });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({ error: "Demande introuvable" });
    });

    it("refuse une demande et la marque traitée par l'utilisateur courant", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requestType: "access",
        requesterEmail: "alice@example.com",
        status: "pending",
      } as never);

      const request = new Request("http://localhost/api/rgpd/requests/req-1/process", {
        method: "POST",
        body: JSON.stringify({ action: "refuse" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await processRequest(request as never, {
        params: Promise.resolve({ id: "req-1" }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ message: "Demande refusee" });
      expect(prismaMock.gdprRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1" },
          data: expect.objectContaining({
            status: "refused",
            processedBy: "user-1",
          }),
        })
      );
    });

    it("traite une demande d'accès, exporte les données et écrit les audits", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requestType: "access",
        requesterEmail: "alice@example.com",
        status: "pending",
      } as never);
      exportTenantData.mockResolvedValue({
        tenants: [{ tenant: { id: "tenant-1" } }],
      });

      const request = new Request("http://localhost/api/rgpd/requests/req-1/process", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await processRequest(request as never, {
        params: Promise.resolve({ id: "req-1" }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ message: "Demande traitee avec succes" });
      expect(exportTenantData).toHaveBeenCalledWith("society-1", "alice@example.com");
      expect(createAuditLog).toHaveBeenNthCalledWith(1, {
        societyId: "society-1",
        userId: "user-1",
        action: "EXPORT",
        entity: "GdprRequest",
        entityId: "req-1",
        details: {
          type: "access",
          email: "alice@example.com",
          tenantCount: 1,
        },
      });
      expect(createAuditLog).toHaveBeenNthCalledWith(2, {
        societyId: "society-1",
        userId: "user-1",
        action: "UPDATE",
        entity: "GdprRequest",
        entityId: "req-1",
        details: {
          type: "access",
          email: "alice@example.com",
        },
      });
      expect(prismaMock.gdprRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1" },
          data: expect.objectContaining({
            status: "completed",
            processedBy: "user-1",
          }),
        })
      );
    });

    it("retourne 500 si une suppression échoue à cause d'un bail actif", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requestType: "deletion",
        requesterEmail: "alice@example.com",
        status: "pending",
      } as never);
      prismaMock.tenant.findMany.mockResolvedValue([
        {
          id: "tenant-1",
          firstName: "Alice",
          lastName: "Durand",
        },
      ] as never);
      prismaMock.lease.count.mockResolvedValue(1);

      const request = new Request("http://localhost/api/rgpd/requests/req-1/process", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await processRequest(request as never, {
        params: Promise.resolve({ id: "req-1" }),
      });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ error: "Erreur lors du traitement" });
      expect(prismaMock.tenant.update).not.toHaveBeenCalled();
      expect(prismaMock.gdprRequest.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "completed" }),
        })
      );
    });

    it("traite une suppression en anonymisant les locataires puis clôture la demande", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requestType: "deletion",
        requesterEmail: "alice@example.com",
        status: "pending",
      } as never);
      prismaMock.tenant.findMany.mockResolvedValue([
        {
          id: "tenant-1",
          firstName: "Alice",
          lastName: "Durand",
          email: "alice@example.com",
        },
      ] as never);
      prismaMock.lease.count.mockResolvedValue(0);

      const request = new Request("http://localhost/api/rgpd/requests/req-1/process", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await processRequest(request as never, {
        params: Promise.resolve({ id: "req-1" }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ message: "Demande traitee avec succes" });
      expect(prismaMock.tenant.update).toHaveBeenCalledWith({
        where: { id: "tenant-1" },
        data: {
          firstName: "ANONYMISE",
          lastName: "ANONYMISE",
          email: "anonymise-tenant-1@deleted.local",
          phone: null,
          mobile: null,
          birthDate: null,
          birthPlace: null,
          personalAddress: null,
          idDocumentUrl: null,
          notes: null,
          isActive: false,
        },
      });
      expect(createAuditLog).toHaveBeenCalledWith({
        societyId: "society-1",
        userId: "user-1",
        action: "UPDATE",
        entity: "GdprRequest",
        entityId: "req-1",
        details: {
          type: "deletion",
          email: "alice@example.com",
        },
      });
    });

    it("anonymise tous les locataires correspondant au même email avant de clôturer la demande", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requestType: "deletion",
        requesterEmail: "alice@example.com",
        status: "pending",
      } as never);
      prismaMock.tenant.findMany.mockResolvedValue([
        {
          id: "tenant-1",
          firstName: "Alice",
          lastName: "Durand",
          email: "alice@example.com",
        },
        {
          id: "tenant-2",
          firstName: "Alice",
          lastName: "Martin",
          email: "alice@example.com",
        },
      ] as never);
      prismaMock.lease.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const request = new Request("http://localhost/api/rgpd/requests/req-1/process", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await processRequest(request as never, {
        params: Promise.resolve({ id: "req-1" }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ message: "Demande traitee avec succes" });
      expect(prismaMock.tenant.findMany).toHaveBeenCalledWith({
        where: { societyId: "society-1", email: "alice@example.com" },
      });
      expect(prismaMock.lease.count).toHaveBeenNthCalledWith(1, {
        where: { tenantId: "tenant-1", status: "EN_COURS" },
      });
      expect(prismaMock.lease.count).toHaveBeenNthCalledWith(2, {
        where: { tenantId: "tenant-2", status: "EN_COURS" },
      });
      expect(prismaMock.tenant.update).toHaveBeenNthCalledWith(1, {
        where: { id: "tenant-1" },
        data: expect.objectContaining({
          firstName: "ANONYMISE",
          lastName: "ANONYMISE",
          email: "anonymise-tenant-1@deleted.local",
          isActive: false,
        }),
      });
      expect(prismaMock.tenant.update).toHaveBeenNthCalledWith(2, {
        where: { id: "tenant-2" },
        data: expect.objectContaining({
          firstName: "ANONYMISE",
          lastName: "ANONYMISE",
          email: "anonymise-tenant-2@deleted.local",
          isActive: false,
        }),
      });
    });

    it("traite une opposition en désactivant les locataires puis clôture la demande", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requestType: "opposition",
        requesterEmail: "alice@example.com",
        status: "pending",
      } as never);

      const request = new Request("http://localhost/api/rgpd/requests/req-1/process", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await processRequest(request as never, {
        params: Promise.resolve({ id: "req-1" }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ message: "Demande traitee avec succes" });
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith({
        where: { societyId: "society-1", email: "alice@example.com" },
        data: { isActive: false },
      });
      expect(createAuditLog).toHaveBeenCalledWith({
        societyId: "society-1",
        userId: "user-1",
        action: "UPDATE",
        entity: "GdprRequest",
        entityId: "req-1",
        details: {
          type: "opposition",
          email: "alice@example.com",
        },
      });
    });

    it("traite une opposition sans locataire correspondant de façon idempotente", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requestType: "opposition",
        requesterEmail: "ghost@example.com",
        status: "pending",
      } as never);
      prismaMock.tenant.updateMany.mockResolvedValue({ count: 0 } as never);

      const request = new Request("http://localhost/api/rgpd/requests/req-1/process", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await processRequest(request as never, {
        params: Promise.resolve({ id: "req-1" }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ message: "Demande traitee avec succes" });
      expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith({
        where: { societyId: "society-1", email: "ghost@example.com" },
        data: { isActive: false },
      });
      expect(prismaMock.gdprRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1" },
          data: expect.objectContaining({
            status: "completed",
            processedBy: "user-1",
          }),
        })
      );
    });

    it("traite une rectification sans export ni désactivation puis clôture la demande", async () => {
      prismaMock.gdprRequest.findFirst.mockResolvedValue({
        id: "req-1",
        societyId: "society-1",
        requestType: "rectification",
        requesterEmail: "alice@example.com",
        status: "pending",
      } as never);

      const request = new Request("http://localhost/api/rgpd/requests/req-1/process", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await processRequest(request as never, {
        params: Promise.resolve({ id: "req-1" }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ message: "Demande traitee avec succes" });
      expect(exportTenantData).not.toHaveBeenCalled();
      expect(prismaMock.tenant.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.gdprRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1" },
          data: expect.objectContaining({
            status: "completed",
            processedBy: "user-1",
          }),
        })
      );
      expect(createAuditLog).toHaveBeenCalledWith({
        societyId: "society-1",
        userId: "user-1",
        action: "UPDATE",
        entity: "GdprRequest",
        entityId: "req-1",
        details: {
          type: "rectification",
          email: "alice@example.com",
        },
      });
    });
  });
});
