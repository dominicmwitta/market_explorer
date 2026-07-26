import { getMarketMetrics } from "@/lib/db";
import SectorsClient from "./SectorsClient";

export const dynamic = "force-dynamic";

export default async function SectorsPage() {
  const metrics = await getMarketMetrics();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sector Performance</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Average return, stock count, and turnover by sector across the full price history.
        </p>
      </div>

      <SectorsClient metrics={metrics} />
    </div>
  );
}
