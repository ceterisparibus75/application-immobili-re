import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "@/test/mocks/prisma";

const { createClient, sendDataroomAccessEmail, limitMock } = vi.hoisted(() => ({
  createClient: vi.fn(),
  sendDataroomAccessEmail: vi.fn().mockResolvedValue(undefined),
  limitMock: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 10_000 }),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/lib/email", () => ({ sendDataroomAccessEmail }));
vi.mock("@/lib/env", () => ({ env: process.env }));
vi.mock("@/lib/rate-limit", () => ({
  getApiRatelimit: () => ({ limit: limitMock }),
}));

import { GET } from "./route";

describe("GET /api/dataroom/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.SUPABASE_STORAGE_BUCKET = "private-docs";
    process.env.AUTH_URL = "https://app.test";

    createClient.mockReturnValue({
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://signed.test/document.pdf" },
          }),
        }),
      },
    });
    prismaMock.dataroom.findUnique.mockResolvedValue({
      id: "dr-1",
      name: "Due diligence",
      description: "Documents",
      status: "ACTIF",
      expiresAt: null,
      password: null,
      creator: { email: "owner@test.fr" },
      documents: [
        {
          sortOrder: 1,
          document: {
            id: "doc-1",
            fileName: "bail.pdf",
            fileSize: 123,
            mimeType: "application/pdf",
            category: "bail",
            description: null,
            storagePath: "documents/soc-1/general/bail.pdf",
          },
        },
      ],
    } as never);
    prismaMock.dataroomAccess.create.mockResolvedValue({} as never);
    prismaMock.dataroom.update.mockResolvedValue({} as never);
  });

  it("utilise le bucket configuré et l'URL applicative pour les notifications", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/dataroom/share-token", {
        headers: { "x-forwarded-for": "203.0.113.10", "x-viewer-email": "viewer@test.fr" },
      }),
      { params: Promise.resolve({ token: "share-token" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.documents[0].signedUrl).toBe("https://signed.test/document.pdf");
    expect(createClient).toHaveBeenCalledWith("https://supabase.test", "service-role");
    expect(sendDataroomAccessEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        dataroomUrl: "https://app.test/dataroom/dr-1",
        viewerIp: "203.0.113.10",
        viewerEmail: "viewer@test.fr",
      })
    );
  });
});
