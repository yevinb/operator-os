import { Suspense } from "react";
import IntegrationsContent from "./IntegrationsContent";

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-text-2">Loading integrations…</div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
