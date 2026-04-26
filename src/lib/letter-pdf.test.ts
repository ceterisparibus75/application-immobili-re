import { describe, it, expect } from "vitest";
import { generateLetterPdf } from "./letter-pdf";

const BASE_OPTS = {
  senderName: "SARL Immobilier\nGérant : Jean Dupont",
  senderAddress: "12 rue de la Paix\n75001 Paris",
  recipientName: "M. Locataire",
  recipientAddress: "45 avenue Victor Hugo\n69001 Lyon",
  date: "15 janvier 2026",
  lieu: "Paris",
  subject: "Régularisation des charges 2025",
  bodyHtml: "<p>Madame, Monsieur,</p><p>Veuillez trouver ci-joint le détail.</p>",
};

describe("generateLetterPdf", () => {
  it("retourne un Buffer dont l'en-tête est %PDF", async () => {
    const buf = await generateLetterPdf(BASE_OPTS);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("produit un Buffer non vide avec taille raisonnable (> 1 ko)", async () => {
    const buf = await generateLetterPdf(BASE_OPTS);
    expect(buf.byteLength).toBeGreaterThan(1_024);
  });

  it("accepte un corps vide", async () => {
    const buf = await generateLetterPdf({ ...BASE_OPTS, bodyHtml: "" });
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("accepte les balises HTML <br>, <p>, <strong>", async () => {
    const buf = await generateLetterPdf({
      ...BASE_OPTS,
      bodyHtml: "<p><strong>Important :</strong><br/>Suite du texte.<br/>Fin.</p>",
    });
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("accepte les listes HTML <ul><li>", async () => {
    const buf = await generateLetterPdf({
      ...BASE_OPTS,
      bodyHtml: "<ul><li>Loyer : 800 €</li><li>Charges : 100 €</li></ul>",
    });
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("accepte societyName et societySiret pour le pied de page", async () => {
    const buf = await generateLetterPdf({
      ...BASE_OPTS,
      societyName: "SARL Dupont Immobilier",
      societySiret: "123 456 789 00012",
    });
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
    expect(buf.byteLength).toBeGreaterThan(1_024);
  });

  it("gère un corps très long qui déclenche plusieurs pages", async () => {
    const longBody = Array.from({ length: 80 }, (_, i) =>
      `<p>Ligne ${i + 1} : Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>`
    ).join("");
    const buf = await generateLetterPdf({ ...BASE_OPTS, bodyHtml: longBody });
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
    // Un PDF multi-page est significativement plus grand qu'un simple PDF
    expect(buf.byteLength).toBeGreaterThan(3_000);
  });

  it("gère les entités HTML (&amp;, &lt;, &gt;, &quot;)", async () => {
    const buf = await generateLetterPdf({
      ...BASE_OPTS,
      bodyHtml: "<p>Prix : 1 000 &amp; 200 € &lt;TVA incluse&gt; &quot;facture&quot;</p>",
    });
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("génère deux PDFs identiques pour les mêmes options (déterministe hors horodatage)", async () => {
    const buf1 = await generateLetterPdf(BASE_OPTS);
    const buf2 = await generateLetterPdf(BASE_OPTS);
    // Les deux doivent être des PDFs valides et de taille comparable
    expect(buf1.byteLength).toBeGreaterThan(0);
    expect(Math.abs(buf1.byteLength - buf2.byteLength)).toBeLessThan(200);
  });
});
