import { getPriceHistoryForTickers, getTickers } from "@/lib/db";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tickers = await getTickers();
  const historyByTicker = await getPriceHistoryForTickers(tickers.map((t) => t.ticker));

  return <HomeClient tickers={tickers} historyByTicker={historyByTicker} />;
}
