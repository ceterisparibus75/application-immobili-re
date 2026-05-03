import { MailWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function MissingTenantEmailBadge() {
  return (
    <Badge variant="outline" className="gap-1 text-amber-700 border-amber-200 bg-amber-50">
      <MailWarning className="h-3 w-3" />
      Email locataire manquant
    </Badge>
  );
}
