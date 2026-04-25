import { describe, it, expect } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { createInternalNotification } from "./notifications-internal";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const USER_ID = "clh3x2z4k0001qh8g7z1y2v3u";

const validInput = {
  userId: USER_ID,
  societyId: SOCIETY_ID,
  type: "PAYMENT_RECEIVED" as const,
  title: "Paiement reçu",
  message: "Le locataire a payé la facture #INV-001",
};

describe("createInternalNotification", () => {
  it("crée une notification avec les données fournies", async () => {
    const created = { id: "notif-1", ...validInput, link: null, read: false, createdAt: new Date() };
    prismaMock.notification.create.mockResolvedValue(created as never);

    const result = await createInternalNotification(validInput);

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        societyId: SOCIETY_ID,
        type: "PAYMENT_RECEIVED",
        title: "Paiement reçu",
        message: "Le locataire a payé la facture #INV-001",
        link: undefined,
      },
    });
    expect(result).toEqual(created);
  });

  it("inclut le link optionnel si fourni", async () => {
    prismaMock.notification.create.mockResolvedValue({} as never);

    await createInternalNotification({ ...validInput, link: "/facturation/INV-001" });

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ link: "/facturation/INV-001" }),
    });
  });

  it("retourne la notification créée", async () => {
    const expected = { id: "notif-2", ...validInput };
    prismaMock.notification.create.mockResolvedValue(expected as never);

    const result = await createInternalNotification(validInput);
    expect(result.id).toBe("notif-2");
  });
});
