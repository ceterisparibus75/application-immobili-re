import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { anthropicMessagesStream, requireActiveSocietyRouteContext } = vi.hoisted(() => ({
  anthropicMessagesStream: vi.fn(),
  requireActiveSocietyRouteContext: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { stream: anthropicMessagesStream };

    constructor(_options: unknown) {}
  },
}));

vi.mock("@/lib/api-society", () => ({
  requireActiveSocietyRouteContext,
}));

import { POST } from "./route";

const ORIGINAL_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_LOAN_PARSE_PDF_DEBUG = process.env.LOAN_PARSE_PDF_DEBUG;

function makePdfFile() {
  return new File([Buffer.from("%PDF-1.7")], "tableau-amortissement.pdf", {
    type: "application/pdf",
  });
}

function makeRequest(file: File | null = makePdfFile()) {
  const formData = new FormData();
  if (file) {
    formData.set("file", file);
  }

  return new Request("http://localhost/api/emprunts/parse-pdf", {
    method: "POST",
    body: formData,
  }) as never;
}

function mockAnthropicText(text: string) {
  anthropicMessagesStream.mockReturnValue({
    finalMessage: vi.fn().mockResolvedValue({
      content: [{ type: "text", text }],
    }),
  });
}

function loanPayload() {
  return {
    _rawColumns: ["Date", "Capital amorti", "Interets", "CRD"],
    _rawFirstRow: {
      Date: "2026-01-01",
      "Capital amorti": "1000,00",
    },
    label: "Pret bancaire",
    lender: "Banque Test",
    loanType: "AMORTISSABLE",
    amount: 120000,
    interestRate: 3.2,
    insuranceRate: 0.12,
    durationMonths: 120,
    startDate: "2026-01-01",
    schedule: [
      {
        period: 1,
        dueDate: "2026-02-01",
        principal: 1000,
        interest: 320,
        insurance: 12,
        total: 1332,
        balance: 119000,
      },
    ],
  };
}

describe("POST /api/emprunts/parse-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.LOAN_PARSE_PDF_DEBUG;
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: "society-1",
      userId: "user-1",
    });
    mockAnthropicText(JSON.stringify(loanPayload()));
  });

  afterEach(() => {
    if (ORIGINAL_ANTHROPIC_API_KEY === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC_API_KEY;
    }

    if (ORIGINAL_LOAN_PARSE_PDF_DEBUG === undefined) {
      delete process.env.LOAN_PARSE_PDF_DEBUG;
    } else {
      process.env.LOAN_PARSE_PDF_DEBUG = ORIGINAL_LOAN_PARSE_PDF_DEBUG;
    }
  });

  it("retourne 500 si la cle Anthropic n'est pas configuree", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("ANTHROPIC_API_KEY");
    expect(anthropicMessagesStream).not.toHaveBeenCalled();
  });

  it("retourne 400 si aucun fichier n'est transmis", async () => {
    const res = await POST(makeRequest(null));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Aucun fichier fourni" });
    expect(anthropicMessagesStream).not.toHaveBeenCalled();
  });

  it("renvoie les donnees metier sans exposer le diagnostic par defaut", async () => {
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      data: {
        label: "Pret bancaire",
        lender: "Banque Test",
        loanType: "AMORTISSABLE",
        amount: 120000,
        interestRate: 3.2,
        insuranceRate: 0.12,
        durationMonths: 120,
        startDate: "2026-01-01",
        schedule: [
          {
            period: 1,
            dueDate: "2026-02-01",
            principal: 1000,
            interest: 320,
            insurance: 12,
            total: 1332,
            balance: 119000,
          },
        ],
      },
    });
    expect(body._debug).toBeUndefined();
  });

  it("expose le diagnostic uniquement avec LOAN_PARSE_PDF_DEBUG=1", async () => {
    process.env.LOAN_PARSE_PDF_DEBUG = "1";

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body._debug).toMatchObject({
      rawColumns: ["Date", "Capital amorti", "Interets", "CRD"],
      linesExtracted: 1,
      allPrincipalZero: false,
      allBalanceConstant: false,
      detectedLoanType: "AMORTISSABLE",
    });
  });

  it("ne loggue pas les erreurs Anthropic hors mode debug", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    anthropicMessagesStream.mockImplementation(() => {
      throw new Error("anthropic unavailable");
    });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("anthropic unavailable");
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
