"use server";

// Barrel — re-exporte toutes les actions de facturation depuis les sous-modules
export * from "./invoice-queries";
export * from "./invoice-generation";
export * from "./invoice-lifecycle";
export type { InvoicePreview, InvoicePreviewLine, InvoicePreviewSociety } from "./invoice-shared";
