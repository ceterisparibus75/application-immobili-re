/**
 * Génération de fichiers SEPA PAIN.001.001.03 (Customer Credit Transfer Initiation)
 * Spécification : ISO 20022 / SEPA Credit Transfer Scheme
 * Pas de dépendances externes — construction XML pure.
 */

export interface SepaCreditTransferInput {
  msgId: string;
  debtorName: string;
  debtorIban: string;    // sans espaces
  debtorBic?: string;
  creditorName: string;
  creditorIban: string;  // sans espaces
  creditorBic?: string;
  amount: number;        // en euros ex: 1500.50
  currency?: string;     // "EUR"
  executionDate: string; // YYYY-MM-DD
  endToEndId: string;    // max 35 chars
  remittanceInfo: string; // max 140 chars
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Génère un XML PAIN.001.001.03 valide pour un virement SEPA.
 */
export function buildPain001Xml(input: SepaCreditTransferInput): string {
  const currency = input.currency ?? "EUR";
  const debtorIban = input.debtorIban.replace(/\s/g, "");
  const creditorIban = input.creditorIban.replace(/\s/g, "");
  const amount = input.amount.toFixed(2);
  const creDtTm = new Date().toISOString();
  // Troncature aux maximums SEPA
  const endToEndId = input.endToEndId.slice(0, 35);
  const remittanceInfo = input.remittanceInfo.slice(0, 140);

  // Bloc BIC débiteur (optionnel)
  const debtorBicBlock = input.debtorBic
    ? `
          <FinInstnId>
            <BIC>${escapeXml(input.debtorBic)}</BIC>
          </FinInstnId>`
    : `
          <FinInstnId>
            <Othr>
              <Id>NOTPROVIDED</Id>
            </Othr>
          </FinInstnId>`;

  // Bloc BIC créancier (optionnel)
  const creditorBicBlock = input.creditorBic
    ? `
              <FinInstnId>
                <BIC>${escapeXml(input.creditorBic)}</BIC>
              </FinInstnId>`
    : `
              <FinInstnId>
                <Othr>
                  <Id>NOTPROVIDED</Id>
                </Othr>
              </FinInstnId>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03 pain.001.001.03.xsd">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${escapeXml(input.msgId)}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${amount}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(input.debtorName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(input.msgId)}-PMT</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${amount}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <CdOrPrtry>
            <Cd>SEPA</Cd>
          </CdOrPrtry>
        </LclInstrm>
      </PmtTpInf>
      <ReqdExctnDt>${escapeXml(input.executionDate)}</ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(input.debtorName)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${escapeXml(debtorIban)}</IBAN>
        </Id>
        <Ccy>${escapeXml(currency)}</Ccy>
      </DbtrAcct>
      <DbtrAgt>${debtorBicBlock}
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(endToEndId)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="${escapeXml(currency)}">${amount}</InstdAmt>
        </Amt>
        <CdtrAgt>${creditorBicBlock}
        </CdtrAgt>
        <Cdtr>
          <Nm>${escapeXml(input.creditorName)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${escapeXml(creditorIban)}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${escapeXml(remittanceInfo)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}
