import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export function DeliveryProofBadge({ sentAt }: { sentAt: Date }) {
  return (
    <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
      <ShieldCheck className="h-3 w-3" />
      Preuve d'envoi {formatDate(sentAt)}
    </Badge>
  );
}
