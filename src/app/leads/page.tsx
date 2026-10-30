import { Suspense } from "react";
import { LeadsDashboard } from "./LeadsDashboard";

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsDashboard />
    </Suspense>
  );
}
