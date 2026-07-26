import { getMarketMetrics } from "@/lib/db";
import PerformanceClient from "./PerformanceClient";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const metrics = await getMarketMetrics();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance Rankings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Total return and risk-adjusted performance across the full price history.
        </p>
      </div>

      <PerformanceClient metrics={metrics} />
    </div>
  );
}
