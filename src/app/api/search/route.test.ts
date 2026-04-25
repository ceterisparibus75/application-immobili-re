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
});
