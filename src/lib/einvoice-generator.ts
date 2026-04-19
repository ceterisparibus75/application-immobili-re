/**
 * Générateur Factur-X (ZUGFeRD / CII) — Profil BASIC
 *
 * Produit un PDF/A-3b avec XML CII embarqué, conforme à la norme EN 16931
 * et à la réforme française de facturation électronique B2B (obligatoire sept. 2026 / 2027).
 *
 * Utilise node-zugferd (https://github.com/jslno/node-zugferd).
 */

import { zugferd } from "node-zugferd";
import { BASIC } from "node-zugferd/profile/basic";
import type { InvoicePdfData } from "@/lib/invoice-pdf";

// Instance partagée (profil BASIC — lignes de détail + ventilation TVA)
const invoicer = zugferd({ profile: BASIC, strict: false });

/**
 * Type inféré depuis le profil BASIC.
 */
type BasicSchema = typeof invoicer.$Infer.Schema;

/**
 * Convertit les données de la facture MyGestia en structure Factur-X BASIC
 * puis embed le XML CII dans le buffer PDF fourni.
 *
 * @param pdfBuffer - Buffer du PDF généré par @react-pdf/renderer
 * @param data      - Données de la facture (InvoicePdfData)
 * @returns Buffer PDF/A-3b avec XML Factur-X embarqué
 */
export async function generateFacturX(
  pdfBuffer: Buffer,
  data: InvoicePdfData
): Promise<Buffer> {
  const schema = buildSchema(data);
  const invoice = invoicer.create(schema);

  const pdfA = await invoice.embedInPdf(pdfBuffer, {
    metadata: {
      title: `Facture ${data.invoiceNumber}`,
      author: data.society?.name ?? "MyGestia",
      subject: `Facture électronique ${data.invoiceNumber}`,
      keywords: ["facture", "factur-x", "mygestia"],
    },
  });

  return Buffer.from(pdfA);
}

/**
 * Génère uniquement le XML CII sans PDF.
 * Utile pour les tests ou l'export XML pur.
 */
export async function generateFacturXml(data: InvoicePdfData): Promise<string> {
  const schema = buildSchema(data);
  const invoice = invoicer.create(schema);
  return invoice.toXML();
}

// ---------------------------------------------------------------------------
// Construction du schéma BASIC selon les types node-zugferd
// ---------------------------------------------------------------------------

function buildSchema(data: InvoicePdfData): BasicSchema {
  const soc = data.society;

  // 380 = facture commerciale, 381 = avoir/note de crédit
  const typeCode: BasicSchema["typeCode"] = data.isAvoir ? "381" : "380";

  const sellerCountry = (
    soc?.country?.toUpperCase() ?? "FR"
  ) as BasicSchema["transaction"]["tradeAgreement"]["seller"]["postalAddress"]["countryCode"];

  const vatBreakdown = computeVatBreakdown(data.lines);

  return {
    number: data.invoiceNumber,
    typeCode,
    issueDate: new Date(data.issueDate),

    transaction: {
      // Accord commercial (vendeur / acheteur)
      tradeAgreement: {
        seller: {
          name: soc?.name ?? "—",
          // BT-30 : identifiant d'enregistrement légal du vendeur (SIRET, scheme 0009 = France)
          ...(soc?.siret
            ? { organization: { registrationIdentifier: { value: soc.siret, schemeIdentifier: "0009" as const } } }
            : {}),
          postalAddress: {
            countryCode: sellerCountry,
            ...(soc?.addressLine1 ? { line1: soc.addressLine1 } : {}),
            ...(soc?.postalCode ? { postCode: soc.postalCode } : {}),
            ...(soc?.city ? { city: soc.city } : {}),
          },
          // BT-34 : adresse électronique du vendeur (obligatoire EN 16931)
          // Priorité : email → SIRET (scheme 0009 = France) → SIREN
          ...(soc?.email
            ? { electronicAddress: { value: soc.email, schemeIdentifier: "EM" as const } }
            : soc?.siret
            ? { electronicAddress: { value: soc.siret, schemeIdentifier: "0009" as const } }
            : {}),
          ...(soc?.vatNumber
            ? { taxRegistration: { vatIdentifier: soc.vatNumber } }
            : {}),
        },
        buyer: {
          name: data.tenant.name,
          postalAddress: {
            countryCode: "FR",
            ...(data.tenant.address ? { line1: data.tenant.address } : {}),
          },
        },
      },

      // Livraison (obligatoire mais vide pour les services)
      tradeDelivery: {},

      // Règlement financier
      tradeSettlement: {
        currencyCode: "EUR",

        // Ventilation TVA par taux (BG-23)
        vatBreakdown: vatBreakdown.map((vat) => ({
          calculatedAmount: round(vat.vatAmount),
          typeCode: "VAT",
          basisAmount: round(vat.basisHT),
          categoryCode: (vat.vatRate === 0 ? "E" : "S") as "E" | "S",
          rateApplicablePercent: vat.vatRate,
        })),

        // Récapitulatif financier (BG-22)
        monetarySummation: {
          lineTotalAmount: round(data.totalHT),
          taxBasisTotalAmount: round(data.totalHT),
          taxTotal: {
            amount: round(data.totalVAT),
            currencyCode: "EUR" as const,
          },
          grandTotalAmount: round(data.totalTTC),
          duePayableAmount: round(data.totalTTC),
        },

        // Conditions de paiement (BT-20-00)
        paymentTerms: {
          dueDate: new Date(data.dueDate),
        },
      },

      // Lignes de détail (BG-25)
      line: data.lines.map((invoiceLine, idx) => ({
        identifier: String(idx + 1),

        // Désignation produit/service (BG-31)
        tradeProduct: {
          name: invoiceLine.label,
        },

        // Prix unitaire (BG-29)
        tradeAgreement: {
          netTradePrice: {
            chargeAmount: round(invoiceLine.totalHT),
          },
        },

        // Quantité facturée (BT-129-00)
        tradeDelivery: {
          billedQuantity: {
            amount: 1,
            unitMeasureCode: "C62" as const, // unité sans dimension
          },
        },

        // Règlement de la ligne (BG-30-00)
        tradeSettlement: {
          tradeTax: {
            typeCode: "VAT",
            categoryCode: (invoiceLine.vatRate === 0 ? "E" : "S") as "E" | "S",
            rateApplicablePercent: invoiceLine.vatRate,
          },
          monetarySummation: {
            lineTotalAmount: round(invoiceLine.totalHT),
          },
        },
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Utilitaires internes
// ---------------------------------------------------------------------------

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

interface VatBreakdownLine {
  vatRate: number;
  basisHT: number;
  vatAmount: number;
}

function computeVatBreakdown(
  lines: InvoicePdfData["lines"]
): VatBreakdownLine[] {
  const map = new Map<number, VatBreakdownLine>();
  for (const line of lines) {
    const existing = map.get(line.vatRate);
    if (existing) {
      existing.basisHT += line.totalHT;
      existing.vatAmount += line.totalTTC - line.totalHT;
    } else {
      map.set(line.vatRate, {
        vatRate: line.vatRate,
        basisHT: line.totalHT,
        vatAmount: line.totalTTC - line.totalHT,
      });
    }
  }
  return Array.from(map.values());
}
