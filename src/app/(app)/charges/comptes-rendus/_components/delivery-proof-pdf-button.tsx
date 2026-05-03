import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeliveryProofPdfButton({ deliveryId }: { deliveryId: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/api/charges/delivery-proofs/${deliveryId}/pdf`} target="_blank">
        <ShieldCheck className="h-3.5 w-3.5 mr-1" />
        Preuve
      </Link>
    </Button>
  );
}
