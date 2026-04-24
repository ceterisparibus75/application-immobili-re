import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn().mockImplementation((fn: () => unknown) => fn),
}));
vi.mock("@/lib/utils", () => ({
  buildLenderMapping: vi.fn().mockReturnValue({}),
  cn: vi.fn(),
  formatCurrency: vi.fn(),
  formatDate: vi.fn(),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { getAnalyticsData, getConsolidatedAnalyticsData } from "./analytics";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("getAnalyticsData", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getAnalyticsData(SOCIETY_ID);
    expect(result).toBeNull();
  });
});

describe("getConsolidatedAnalyticsData", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getConsolidatedAnalyticsData();
    expect(result).toBeNull();
  });

  it("retourne null si aucune société trouvée pour le propriétaire", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.society.findMany.mockResolvedValue([]);

    const result = await getConsolidatedAnalyticsData();
    expect(result).toBeNull();
  });
});
