import { getDailyTurnoverByCompany, getMarketMetrics } from "@/lib/db";
import VolumeClient from "./VolumeClient";

export const dynamic = "force-dynamic";

export default async function VolumePage() {
  const [metrics, dailyTurnoverByCompany] = await Promise.all([
    getMarketMetrics(),
    getDailyTurnoverByCompany(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Volume Analysis</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Trading turnover by stock, market share, and the daily turnover trend across the full
          history.
        </p>
      </div>

      <VolumeClient metrics={metrics} dailyTurnoverByCompany={dailyTurnoverByCompany} />
    </div>
  );
}
