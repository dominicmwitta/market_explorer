import { getPriceHistoryForTickers, getTickers } from "@/lib/db";
import SectorsClient from "./SectorsClient";

export const dynamic = "force-dynamic";

export default async function SectorsPage(props: PageProps<"/sectors">) {
  const searchParams = await props.searchParams;
  const sectorParam = searchParams.sector;
  const initialSector = Array.isArray(sectorParam) ? sectorParam[0] : sectorParam;

  const tickers = await getTickers();
  const history = await getPriceHistoryForTickers(tickers.map((t) => t.ticker));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sector Performance</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Average return, stock count, and turnover by sector for the selected period.
        </p>
      </div>

      <SectorsClient tickers={tickers} history={history} initialSector={initialSector} />
    </div>
  );
}
