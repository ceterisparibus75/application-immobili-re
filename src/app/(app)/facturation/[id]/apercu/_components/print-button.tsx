"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton({ filename }: { filename?: string }) {
  function handlePrint() {
    const prev = document.title;
    if (filename) document.title = filename;
    window.print();
    // Restaurer le titre après que la boîte de dialogue d'impression se ferme
    setTimeout(() => { document.title = prev; }, 500);
  }

  return (
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4" />
      Imprimer / PDF
    </Button>
  );
}
