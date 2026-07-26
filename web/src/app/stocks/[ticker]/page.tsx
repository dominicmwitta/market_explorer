import { notFound } from "next/navigation";
import { getPriceHistory, getTickers } from "@/lib/db";
import StockDetailClient from "./StockDetailClient";

export const dynamic = "force-dynamic";

export default async function StockDetailPage(props: PageProps<"/stocks/[ticker]">) {
  const { ticker: rawTicker } = await props.params;
  const ticker = decodeURIComponent(rawTicker);

  const [history, tickers] = await Promise.all([getPriceHistory(ticker), getTickers()]);
  if (history.length === 0) {
    notFound();
  }

  const sector = tickers.find((t) => t.ticker === ticker)?.sector ?? "Unknown";

  return <StockDetailClient ticker={ticker} sector={sector} history={history} />;
}
