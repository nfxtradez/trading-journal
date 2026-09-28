import { CheckCircle2 } from "lucide-react";
import TradeForm from "@/components/TradeForm";
import PageHeader from "@/components/PageHeader";
import { createTrade } from "@/app/actions";
import { listTags } from "@/lib/trades";

export default async function NewTradePage({ searchParams }: PageProps<"/journal/new">) {
  const { saved } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Log a trade" subtitle="P&L is calculated automatically from prices and contract size (NQ $20/pt, ES $50/pt)." />
      {saved && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-profit/40 bg-profit/10 px-4 py-3 text-sm text-profit">
          <CheckCircle2 className="size-4" /> Trade saved. Log the next one below.
        </div>
      )}
      <TradeForm key={String(saved ?? "")} action={createTrade} tags={listTags()} />
    </div>
  );
}
