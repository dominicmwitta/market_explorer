import { NextRequest, NextResponse } from "next/server";
import { getPriceHistoryForTickers } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/price-trends?tickers=A,B,C -> { [ticker]: PricePoint[] }, backs the /price-trends multi-select. */
export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers");
  const tickers = tickersParam
    ? tickersParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  if (tickers.length === 0) {
    return NextResponse.json({});
  }

  const history = await getPriceHistoryForTickers(tickers);
  return NextResponse.json(history);
}
