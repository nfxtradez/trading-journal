import ImportPanel from "@/components/ImportPanel";
import PageHeader from "@/components/PageHeader";
import { listTags } from "@/lib/trades";
import { ready } from "@/lib/session";

export default async function ImportPage() {
  await ready();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Import from TradingView"
        subtitle="Paper Trading exports for NQ, ES, MNQ and MES are converted into round-trip trades with P&L."
      />
      <ImportPanel tags={listTags()} />
    </div>
  );
}
