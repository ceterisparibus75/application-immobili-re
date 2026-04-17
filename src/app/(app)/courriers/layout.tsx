import type { Metadata } from "next";

export const metadata: Metadata = { title: "Courriers" };

export default function CourriersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
