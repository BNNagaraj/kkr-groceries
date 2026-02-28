"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface OverviewChartsProps {
  recentDates: string[];
  spentByDate: Record<string, number>;
  topItems: [string, number][];
}

export default function OverviewCharts({
  recentDates,
  spentByDate,
  topItems,
}: OverviewChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[300px]">
        <h3 className="font-bold mb-4 text-slate-800">Recent Spending</h3>
        <Bar
          data={{
            labels: recentDates,
            datasets: [
              {
                label: "Spend (\u20B9)",
                data: recentDates.map((d) => spentByDate[d]),
                backgroundColor: "#3b82f6",
                borderRadius: 4,
              },
            ],
          }}
          options={{ maintainAspectRatio: false }}
        />
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[300px] flex flex-col">
        <h3 className="font-bold mb-4 text-slate-800">Top Items</h3>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <Pie
            data={{
              labels: topItems.map((x) => x[0]),
              datasets: [
                {
                  data: topItems.map((x) => x[1]),
                  backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
                },
              ],
            }}
            options={{ maintainAspectRatio: false }}
          />
        </div>
      </div>
    </div>
  );
}
