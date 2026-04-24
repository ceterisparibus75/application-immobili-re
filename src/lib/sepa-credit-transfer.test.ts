import { describe, it, expect } from "vitest";
import { buildPain001Xml } from "./sepa-credit-transfer";

const BASE_INPUT = {
  msgId: "MSG-001",
  debtorName: "SCI Les Pins",
  debtorIban: "FR76 3000 6000 0112 3456 7890 189",
  creditorName: "EDF Factures",
  creditorIban: "FR76 1234 5678 9012 3456 7890 123",
  amount: 1250.5,
  executionDate: "2025-06-01",
  endToEndId: "E2E-REF-001",
  remittanceInfo: "Facture EDF mars 2025",
};

describe("buildPain001Xml", () => {
  it("produit un XML valide avec le prologue et le namespace ISO 20022", () => {
    const xml = buildPain001Xml(BASE_INPUT);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("urn:iso:std:iso:20022:tech:xsd:pain.001.001.03");
  });

  it("inclut le msgId dans GrpHdr et PmtInfId", () => {
    const xml = buildPain001Xml(BASE_INPUT);
    expect(xml).toContain("<MsgId>MSG-001</MsgId>");
    expect(xml).toContain("<PmtInfId>MSG-001-PMT</PmtInfId>");
  });

  it("formate le montant avec 2 décimales", () => {
    const xml = buildPain001Xml({ ...BASE_INPUT, amount: 1250 });
    expect(xml).toContain("<CtrlSum>1250.00</CtrlSum>");
    expect(xml).toContain('InstdAmt Ccy="EUR">1250.00</InstdAmt>');
  });

  it("supprime les espaces dans les IBAN", () => {
    const xml = buildPain001Xml(BASE_INPUT);
    // L'IBAN débiteur sans espaces
    expect(xml).toContain("<IBAN>FR7630006000011234567890189</IBAN>");
    expect(xml).not.toContain("FR76 3000");
  });

  it("utilise EUR comme devise par défaut", () => {
    const xml = buildPain001Xml(BASE_INPUT);
    expect(xml).toContain('InstdAmt Ccy="EUR"');
  });

  it("utilise la devise fournie si elle est spécifiée", () => {
    const xml = buildPain001Xml({ ...BASE_INPUT, currency: "USD" });
    expect(xml).toContain('InstdAmt Ccy="USD"');
  });

  it("inclut la date d'exécution", () => {
    const xml = buildPain001Xml(BASE_INPUT);
    expect(xml).toContain("<ReqdExctnDt>2025-06-01</ReqdExctnDt>");
  });

  it("inclut endToEndId et remittanceInfo", () => {
    const xml = buildPain001Xml(BASE_INPUT);
    expect(xml).toContain("<EndToEndId>E2E-REF-001</EndToEndId>");
    expect(xml).toContain("<Ustrd>Facture EDF mars 2025</Ustrd>");
  });

  it("tronque endToEndId à 35 caractères", () => {
    const longId = "A".repeat(40);
    const xml = buildPain001Xml({ ...BASE_INPUT, endToEndId: longId });
    expect(xml).toContain("<EndToEndId>" + "A".repeat(35) + "</EndToEndId>");
  });

  it("tronque remittanceInfo à 140 caractères", () => {
    const longInfo = "X".repeat(200);
    const xml = buildPain001Xml({ ...BASE_INPUT, remittanceInfo: longInfo });
    expect(xml).toContain("<Ustrd>" + "X".repeat(140) + "</Ustrd>");
  });

  it("échappe les caractères XML spéciaux dans les noms", () => {
    const xml = buildPain001Xml({
      ...BASE_INPUT,
      debtorName: "SCI <Les & Pins>",
      creditorName: 'M. "Dupont" & Associés',
    });
    expect(xml).toContain("SCI &lt;Les &amp; Pins&gt;");
    // Les accents ne sont pas encodés (hors scope de escapeXml), seuls & " sont échappés
    expect(xml).toContain("M. &quot;Dupont&quot; &amp; Associés");
  });

  it("utilise le bloc NOTPROVIDED si debtorBic absent", () => {
    const xml = buildPain001Xml({ ...BASE_INPUT, debtorBic: undefined });
    // DbtrAgt doit contenir NOTPROVIDED
    expect(xml).toMatch(/<DbtrAgt>[\s\S]*?NOTPROVIDED[\s\S]*?<\/DbtrAgt>/);
  });

  it("utilise le BIC débiteur s'il est fourni", () => {
    const xml = buildPain001Xml({ ...BASE_INPUT, debtorBic: "BNPAFRPPXXX" });
    expect(xml).toContain("<BIC>BNPAFRPPXXX</BIC>");
  });

  it("utilise NOTPROVIDED pour le créancier si creditorBic absent", () => {
    const xml = buildPain001Xml({ ...BASE_INPUT, creditorBic: undefined });
    const cdtrAgtMatch = xml.match(/<CdtrAgt>([\s\S]*?)<\/CdtrAgt>/);
    expect(cdtrAgtMatch).not.toBeNull();
    expect(cdtrAgtMatch![1]).toContain("NOTPROVIDED");
  });

  it("utilise le BIC créancier s'il est fourni", () => {
    const xml = buildPain001Xml({ ...BASE_INPUT, creditorBic: "CMCIFRPPXXX" });
    expect(xml).toContain("<BIC>CMCIFRPPXXX</BIC>");
  });

  it("inclut le nom du débiteur et du créancier", () => {
    const xml = buildPain001Xml(BASE_INPUT);
    expect(xml).toContain("<Nm>SCI Les Pins</Nm>");
    expect(xml).toContain("<Nm>EDF Factures</Nm>");
  });

  it("fixe NbOfTxs à 1", () => {
    const xml = buildPain001Xml(BASE_INPUT);
    const matches = xml.match(/<NbOfTxs>1<\/NbOfTxs>/g);
    expect(matches).toHaveLength(2); // GrpHdr + PmtInf
  });

  it("fixe le code de service niveau à SEPA", () => {
    const xml = buildPain001Xml(BASE_INPUT);
    expect(xml).toContain("<Cd>SEPA</Cd>");
  });
});
