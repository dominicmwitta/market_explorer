import type { NextRequest } from "next/server";
import { getPriceHistoryForTickers } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = [...new Set(tickersParam.split(",").map((t) => t.trim()).filter(Boolean))];
  if (tickers.length === 0) return Response.json({});

  const history = await getPriceHistoryForTickers(tickers);
  return Response.json(history);
}
