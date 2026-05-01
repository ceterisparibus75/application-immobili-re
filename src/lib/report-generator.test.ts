import { describe, expect, it } from "vitest";

import { generateReport as legacyGenerateReport } from "./report-generator";
import { generateReport } from "./reports";

describe("report-generator legacy entrypoint", () => {
  it("réexporte le générateur de rapports canonique", () => {
    expect(legacyGenerateReport).toBe(generateReport);
  });
});
