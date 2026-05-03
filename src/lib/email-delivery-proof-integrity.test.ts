import { describe, expect, it } from "vitest";
import { payloadSha256FromEventPayload } from "./email-delivery-proof-integrity";

describe("email delivery proof integrity", () => {
  it("extrait l'empreinte SHA-256 du payload webhook enrichi", () => {
    expect(
      payloadSha256FromEventPayload({
        type: "email.delivered",
        _mygestia: {
          payloadSha256: "a".repeat(64),
          payloadHashAlgorithm: "sha256",
        },
      }),
    ).toBe("a".repeat(64));
  });

  it("ignore une empreinte absente ou invalide", () => {
    expect(payloadSha256FromEventPayload({ _mygestia: { payloadSha256: "bad" } })).toBeNull();
    expect(payloadSha256FromEventPayload(null)).toBeNull();
  });
});
