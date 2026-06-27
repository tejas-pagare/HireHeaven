"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useAppData } from "@/context/AppContext";
import Loading from "@/components/loading";
import toast from "react-hot-toast";

const JOB_SERVICE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface AnalyticsData {
  statusOverview: { name: string; value: number; color: string }[];
  applicationsOverTime: { month: string; count: number }[];
}

const COLORS = {
  Hired: "hsl(142.1, 76.2%, 36.3%)", // green
  Rejected: "hsl(346.8, 77.2%, 49.8%)", // red
  Pending: "hsl(47.9, 95.8%, 53.1%)", // yellow
  Interview: "hsl(221.2, 83.2%, 53.3%)", // blue
  Assignment: "hsl(283.4, 38.6%, 53.9%)", // purple
};

const Analytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = Cookies.get("token");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await axios.get<AnalyticsData>(`${JOB_SERVICE}/api/job/analytics/jobseeker`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Use backend data or default/empty shapes
        setData({
          statusOverview: response.data.statusOverview || [],
          applicationsOverTime: response.data.applicationsOverTime || [],
        });
      } catch (error: any) {
        toast.error("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  }, [token]);

  if (loading) return <Loading />;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
        <p className="text-muted-foreground">Detailed metrics on your job search performance.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Application Status Overview */}
        <Card className="col-span-1 border-2 shadow-sm">
          <CardHeader>
            <CardTitle>Application Status</CardTitle>
            <CardDescription>Breakdown of your application statuses</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
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
                  >
                    {data.statusOverview.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[entry.name as keyof typeof COLORS] || "#CBD5E1"} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    itemStyle={{ color: "black", fontWeight: 500 }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-sm flex items-center justify-center h-full">No status data available</div>
            )}
          </CardContent>
        </Card>

        {/* Applications Over Time */}
        <Card className="col-span-1 border-2 shadow-sm">
          <CardHeader>
            <CardTitle>Applications Over Time</CardTitle>
            <CardDescription>Your activity for the last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {data?.applicationsOverTime && data.applicationsOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.applicationsOverTime}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(221.2, 83.2%, 53.3%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(221.2, 83.2%, 53.3%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "currentColor" }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "currentColor" }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    itemStyle={{ color: "black", fontWeight: 500 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(221.2, 83.2%, 53.3%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCount)"
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-sm flex items-center justify-center h-full">No activity data available</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
