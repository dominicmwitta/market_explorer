import { getMarketMetrics } from "@/lib/db";
import ReturnsClient from "./ReturnsClient";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const metrics = await getMarketMetrics();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Returns Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Distribution of total returns, the risk/return trade-off, and the latest trading day&apos;s
          momentum.
        </p>
      </div>

      <ReturnsClient metrics={metrics} />
    </div>
  );
}
