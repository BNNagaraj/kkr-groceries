"use client";

import React, { useEffect, useState, useRef } from "react";

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
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [ChartComponents, setChartComponents] = useState<{
    Bar: any;
    Pie: any;
  } | null>(null);
  const registered = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Dynamic imports — keeps chart.js out of Turbopack's static module graph
      const [chartjs, reactChartjs2] = await Promise.all([
        import("chart.js"),
        import("react-chartjs-2"),
      ]);

      if (cancelled) return;

      // Register chart.js components once
      if (!registered.current) {
        chartjs.Chart.register(
          chartjs.CategoryScale,
          chartjs.LinearScale,
          chartjs.BarElement,
          chartjs.Title,
          chartjs.Tooltip,
          chartjs.Legend,
          chartjs.ArcElement
        );
        registered.current = true;
      }

      setChartComponents({
        Bar: reactChartjs2.Bar,
        Pie: reactChartjs2.Pie,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ChartComponents) {
    return (
      <div className="h-[300px] flex items-center justify-center text-slate-400 animate-pulse">
        Loading charts...
      </div>
    );
  }

  const { Bar, Pie } = ChartComponents;

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
                data: recentDates.map((d: string) => spentByDate[d]),
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
              labels: topItems.map((x: [string, number]) => x[0]),
              datasets: [
                {
                  data: topItems.map((x: [string, number]) => x[1]),
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
