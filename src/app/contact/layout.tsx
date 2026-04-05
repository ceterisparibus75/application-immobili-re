import type { Metadata } from "next";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "GestImmo";

export const metadata: Metadata = {
  title: `Contact | ${APP_NAME}`,
  description: "Contactez notre equipe pour toute question sur la gestion de votre patrimoine immobilier.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
