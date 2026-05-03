import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChargeStatementPdfButton({ regularizationId }: { regularizationId: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/api/charges/regularizations/${regularizationId}/pdf`} target="_blank">
        <FileText className="h-3.5 w-3.5 mr-1" />
        PDF
      </Link>
    </Button>
  );
}
