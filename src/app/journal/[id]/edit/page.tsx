import { notFound } from "next/navigation";
import TradeForm from "@/components/TradeForm";
import PageHeader from "@/components/PageHeader";
import { updateTrade } from "@/app/actions";
import { getTrade, listTags } from "@/lib/trades";

export default async function EditTradePage({ params }: PageProps<"/journal/[id]/edit">) {
  const { id } = await params;
  const trade = getTrade(Number(id));
  if (!trade) notFound();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Edit trade · ${trade.symbol} ${trade.direction}`} />
      <TradeForm action={updateTrade.bind(null, trade.id)} tags={listTags()} trade={trade} />
    </div>
  );
}
