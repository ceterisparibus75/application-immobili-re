import { getRentValuations } from "@/actions/rent-valuation";
import { RentValuationPanel } from "@/components/valuation/rent-valuation-panel";

export async function RentValuationPanelWrapper({
  leaseId,
  societyId,
}: {
  leaseId: string;
  societyId: string;
}) {
  const valuations = await getRentValuations(societyId, leaseId);

  return (
    <RentValuationPanel
      valuations={valuations}
      leaseId={leaseId}
      societyId={societyId}
    />
  );
}
