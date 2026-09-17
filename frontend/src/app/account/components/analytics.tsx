"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import Loading from "@/components/loading";
import toast from "react-hot-toast";
import { BarChart3 } from "lucide-react";
import { BACKEND_URL } from "@/lib/config";

const JOB_SERVICE = BACKEND_URL;

interface AnalyticsData {
  statusOverview: { name: string; value: number; color: string }[];
  applicationsOverTime: { month: string; count: number }[];
}

// Pull the series colours from the shared chart tokens so the palette tracks the theme.
const STATUS_COLORS: Record<string, string> = {
  Hired: "var(--chart-2)",
  Rejected: "var(--chart-5)",
  Pending: "var(--chart-3)",
  Interview: "var(--chart-1)",
  Assignment: "var(--chart-4)",
};

/** Themed recharts tooltip — the default is a hardcoded white box. */
const tooltipStyles = {
  contentStyle: {
    borderRadius: "12px",
    border: "1px solid var(--border)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    boxShadow: "var(--shadow-soft-lg)",
  },
  itemStyle: { color: "var(--popover-foreground)", fontWeight: 500 },
  labelStyle: { color: "var(--muted-foreground)" },
  cursor: { fill: "var(--accent)" },
};

const EmptyState = ({ label }: { label: string }) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
    <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
      <BarChart3 size={22} className="text-muted-foreground" />
    </div>
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);

const Analytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = Cookies.get("token");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await axios.get<AnalyticsData>(
          `${JOB_SERVICE}/api/job/analytics/jobseeker`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setData({
          statusOverview: response.data.statusOverview || [],
          applicationsOverTime: response.data.applicationsOverTime || [],
        });
      } catch {
        toast.error("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchAnalytics();
    else setLoading(false);
  }, [token]);

  if (loading) return <Loading />;

  const totalApplications =
    data?.statusOverview.reduce((sum, s) => sum + s.value, 0) ?? 0;

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalApplications > 0
            ? `Across ${totalApplications} application${totalApplications === 1 ? "" : "s"}.`
            : "Metrics on your job search performance."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Application status</CardTitle>
            <CardDescription>
              Breakdown of your application statuses
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-[300px] items-center justify-center">
            {data?.statusOverview && data.statusOverview.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.statusOverview}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {data.statusOverview.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.color ||
                          STATUS_COLORS[entry.name] ||
                          "var(--muted-foreground)"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyles} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => (
                      <span className="text-sm text-muted-foreground">
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="No status data yet" />
            )}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Applications over time</CardTitle>
            <CardDescription>Your activity for the last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {data?.applicationsOverTime &&
            data.applicationsOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.applicationsOverTime}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip {...tooltipStyles} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCount)"
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="No activity data yet" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
