import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../Services/useMe";
import {
  ADMIN_DASHBOARD_YEAR_EVENT,
  getStoredAdminDashboardYear,
} from "../Services/adminDashboardYear";
import socket from "../Services/socket";
import "../styles/NavbarComponents-styles/Dashboard.css";
import completeIcon from "../assets/icons/complete.svg";
import pickupIcon from "../assets/icons/pickup.svg";
import co2Icon from "../assets/icons/co2saved.svg";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WASTE_COLORS = {
  Plastic: "#F59E0B",
  Glass: "#3B82F6",
  Paper: "#EAB308",
  "Electronic Waste": "#6366F1",
  "Organic Waste": "#22C55E",
  Metal: "#6B7280",
  Other: "#94A3B8",
};

const OPPORTUNITY_LINES = {
  open: { key: "open", label: "Open", color: "#16A34A" },
  "in-progress": { key: "inProgress", label: "In Progress", color: "#2563EB" },
  closed: { key: "closed", label: "Closed", color: "#DC2626" },
};

function MetricTooltip({ active, payload, label, accent = false, formatter = (value) => value }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: accent ? "var(--accent-surface)" : "var(--tooltip-bg)",
        color: accent ? "var(--accent-surface-text)" : "var(--tooltip-text)",
        border: accent ? "1px solid var(--accent-border)" : "1px solid var(--border-color)",
        borderRadius: 16,
        boxShadow: "var(--shadow-medium)",
        padding: "12px 14px",
      }}
    >
      <p style={{ margin: 0, fontWeight: 700 }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ margin: "8px 0 0", color: entry.color, fontWeight: 600 }}>
          {entry.name}: {formatter(entry.value)}
        </p>
      ))}
    </div>
  );
}

function EmptyState({ message, light = false }) {
  return (
    <div className={`admin-chart-empty ${light ? "light" : ""}`}>
      <p>{message}</p>
    </div>
  );
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function formatCo2Value(kg) {
  const numeric = Number(kg) || 0;
  if (numeric >= 1000) {
    return `${(numeric / 1000).toFixed(2)} Tons`;
  }

  return `${numeric.toFixed(1)} kg`;
}

function renderPieLabel({ cx, cy, midAngle, outerRadius, name }, labelOffset = 22, fontSize = 12) {
  const radius = outerRadius + labelOffset;
  const radian = Math.PI / 180;
  const x = cx + radius * Math.cos(-midAngle * radian);
  const y = cy + radius * Math.sin(-midAngle * radian);

  return (
    <text
      x={x}
      y={y}
      fill="var(--chart-text)"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      style={{ fontSize, fontWeight: 600 }}
    >
      {name}
    </text>
  );
}

const responsiveChartProps = {
  width: "100%",
  height: "100%",
  debounce: 180,
};

function getChartDensity(width) {
  if (width <= 430) {
    return "tight";
  }

  if (width <= 620) {
    return "compact";
  }

  return "regular";
}

export default function AdminDashboard({ me }) {
  const queryClient = useQueryClient();
  const [opportunityFilter, setOpportunityFilter] = useState("all");
  const [pieMonth, setPieMonth] = useState("All");
  const [selectedYear, setSelectedYear] = useState(() => getStoredAdminDashboardYear());
  const [topFocus, setTopFocus] = useState("left");
  const [bottomFocus, setBottomFocus] = useState("left");
  const [opportunityChartDensity, setOpportunityChartDensity] = useState("regular");
  const [co2ChartDensity, setCo2ChartDensity] = useState("regular");
  const [pieChartDensity, setPieChartDensity] = useState("regular");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard", selectedYear],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/admin/dashboard?year=${selectedYear}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to load admin dashboard");
      }

      return res.json();
    },
    enabled: !!me && me.role === "admin",
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const handleYearChange = (event) => {
      const nextYear = Number(event?.detail?.year);
      if (Number.isFinite(nextYear)) {
        setSelectedYear(nextYear);
      }
    };

    window.addEventListener(ADMIN_DASHBOARD_YEAR_EVENT, handleYearChange);
    return () => {
      window.removeEventListener(ADMIN_DASHBOARD_YEAR_EVENT, handleYearChange);
    };
  }, []);

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }).catch(() => {});
    };

    socket.on("opportunity:created", invalidate);
    socket.on("opportunity:updated", invalidate);
    socket.on("opportunity:deleted", invalidate);
    socket.on("pickup:created", invalidate);
    socket.on("pickup:accepted", invalidate);
    socket.on("pickup:completed", invalidate);
    socket.on("pickup:updated", invalidate);
    socket.on("pickup:deleted", invalidate);

    return () => {
      socket.off("opportunity:created", invalidate);
      socket.off("opportunity:updated", invalidate);
      socket.off("opportunity:deleted", invalidate);
      socket.off("pickup:created", invalidate);
      socket.off("pickup:accepted", invalidate);
      socket.off("pickup:completed", invalidate);
      socket.off("pickup:updated", invalidate);
      socket.off("pickup:deleted", invalidate);
    };
  }, [queryClient]);

  const summary = data?.summary || {};
  const opportunityData = data?.charts?.opportunityTrends || [];
  const pickupData = data?.charts?.pickupTrends || [];
  const co2LineData = data?.charts?.co2Trends || [];
  const currentYear = new Date().getFullYear();
  const pieMonthOptions = useMemo(() => {
    const visibleMonths =
      selectedYear === currentYear ? MONTHS.slice(0, new Date().getMonth() + 1) : MONTHS;
    return ["All", ...visibleMonths];
  }, [currentYear, selectedYear]);
  const pieData =
    pieMonth === "All"
      ? data?.charts?.co2ByWaste?.all || []
      : data?.charts?.co2ByWaste?.months?.[pieMonth] || [];
  const visibleOpportunityLines = opportunityFilter === "all"
    ? Object.values(OPPORTUNITY_LINES)
    : [OPPORTUNITY_LINES[opportunityFilter]].filter(Boolean);

  useEffect(() => {
    if (!pieMonthOptions.includes(pieMonth)) {
      setPieMonth("All");
    }
  }, [pieMonth, pieMonthOptions]);

  const updateChartDensity = (setter) => (width) => {
    const nextDensity = getChartDensity(width);
    setter((currentDensity) => (currentDensity === nextDensity ? currentDensity : nextDensity));
  };

  const chartAnimationDuration = 820;
  const lineAnimationProps = {
    isAnimationActive: true,
    animationDuration: chartAnimationDuration,
    animationEasing: "ease-in-out",
    animationBegin: 80,
  };
  const barAnimationProps = {
    isAnimationActive: true,
    animationDuration: chartAnimationDuration,
    animationEasing: "ease-in-out",
    animationBegin: 40,
  };
  const pieAnimationProps = {
    isAnimationActive: true,
    animationDuration: chartAnimationDuration + 40,
    animationEasing: "ease-in-out",
    animationBegin: 120,
  };
  const yAxisTick = {
    fill: "var(--chart-text)",
    fontSize: 13,
    fontWeight: 700,
  };
  const accentAxisTick = {
    fill: "var(--accent-surface-text)",
    fontSize: 14,
    fontWeight: 700,
  };
  const barChartMargin = { top: 18, right: 14, left: 10, bottom: 12 };
  const opportunityLineChartConfig =
    opportunityChartDensity === "tight"
      ? {
          margin: { top: 30, right: 12, left: 0, bottom: 48 },
          xAxisTick: { fill: "var(--chart-text)", fontSize: 11, fontWeight: 700 },
          xAxisProps: {
            interval: 0,
            minTickGap: 0,
            tickMargin: 10,
            height: 56,
            angle: -32,
            textAnchor: "end",
            padding: { left: 0, right: 0 },
          },
          yAxisWidth: 34,
          dotRadius: 3,
          activeDotRadius: 5,
        }
      : opportunityChartDensity === "compact"
        ? {
            margin: { top: 32, right: 16, left: 4, bottom: 42 },
            xAxisTick: { fill: "var(--chart-text)", fontSize: 12, fontWeight: 700 },
            xAxisProps: {
              interval: 0,
              minTickGap: 0,
              tickMargin: 10,
              height: 48,
              angle: -24,
              textAnchor: "end",
              padding: { left: 0, right: 4 },
            },
            yAxisWidth: 38,
            dotRadius: 3,
            activeDotRadius: 6,
          }
        : {
            margin: { top: 34, right: 26, left: 14, bottom: 18 },
            xAxisTick: { fill: "var(--chart-text)", fontSize: 14, fontWeight: 700 },
            xAxisProps: {
              interval: "preserveStartEnd",
              minTickGap: 6,
              tickMargin: 14,
              height: 30,
              angle: 0,
              textAnchor: "middle",
              padding: { left: 8, right: 16 },
            },
            yAxisWidth: 42,
            dotRadius: 4,
            activeDotRadius: 7,
          };
  const co2LineChartConfig =
    co2ChartDensity === "tight"
      ? {
          margin: { top: 28, right: 12, left: 0, bottom: 56 },
          xAxisTick: { fill: "var(--chart-text)", fontSize: 11, fontWeight: 700 },
          xAxisProps: {
            interval: 0,
            minTickGap: 0,
            tickMargin: 12,
            height: 64,
            angle: -34,
            textAnchor: "end",
            padding: { left: 0, right: 0 },
          },
          yAxisWidth: 42,
          dotRadius: 3,
          activeDotRadius: 5,
        }
      : co2ChartDensity === "compact"
        ? {
            margin: { top: 30, right: 18, left: 4, bottom: 48 },
            xAxisTick: { fill: "var(--chart-text)", fontSize: 12, fontWeight: 700 },
            xAxisProps: {
              interval: 0,
              minTickGap: 0,
              tickMargin: 10,
              height: 52,
              angle: -26,
              textAnchor: "end",
              padding: { left: 0, right: 4 },
            },
            yAxisWidth: 48,
            dotRadius: 3,
            activeDotRadius: 6,
          }
        : {
            margin: { top: 34, right: 26, left: 14, bottom: 18 },
            xAxisTick: { fill: "var(--chart-text)", fontSize: 14, fontWeight: 700 },
            xAxisProps: {
              interval: "preserveStartEnd",
              minTickGap: 6,
              tickMargin: 14,
              height: 30,
              angle: 0,
              textAnchor: "middle",
              padding: { left: 8, right: 16 },
            },
            yAxisWidth: 56,
            dotRadius: 4,
            activeDotRadius: 7,
          };
  const pieLabelRenderer = pieChartDensity === "tight"
    ? false
    : (props) => renderPieLabel(props, pieChartDensity === "compact" ? 16 : 22, pieChartDensity === "compact" ? 11 : 12);

  return (
    <div className="page dashboard-page admin-dashboard-page">
      <div className="page-header-wrapper left">
        <h2 className="page-header">Dashboard</h2>
        <p className="page-subtitle">
          Welcome back, {me?.fullName || "Admin"}! Here&apos;s the WasteZero platform overview for {selectedYear}.
        </p>
      </div>

      <div className="dashboard-stats-container admin-dashboard-stats" style={{ marginBottom: 32 }}>
        <div className="stat-card admin-stat-card">
          <div className="stat-icon admin-stat-icon">
            <lord-icon
              src="https://cdn.lordicon.com/mhridhuu.json"
              trigger="loop"
              stroke="bold"
              state="loop-wave"
              style={{ width: "50px", height: "50px" }}
            />
          </div>
          <div className="stat-content">
            <div className="stat-number">{formatCount(summary.activeOpportunities)}</div>
            <div className="stat-label">Active Opportunities</div>
          </div>
        </div>

        <div className="stat-card admin-stat-card">
          <div className="stat-icon admin-stat-icon">
            <img src={completeIcon} alt="Total opportunities" style={{ width: "50px", height: "50px" }} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{formatCount(summary.totalOpportunities)}</div>
            <div className="stat-label">Total Opportunities</div>
          </div>
        </div>

        <div className="stat-card admin-stat-card">
          <div className="stat-icon admin-stat-icon">
            <img src={pickupIcon} alt="Pickups completed" style={{ width: "50px", height: "50px" }} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{formatCount(summary.pickupsCompleted)}</div>
            <div className="stat-label">Pickups Completed</div>
          </div>
        </div>

        <div className="stat-card admin-stat-card">
          <div className="stat-icon admin-stat-icon">
            <img src={co2Icon} alt="CO2 saved" style={{ width: "50px", height: "50px" }} />
          </div>
          <div className="stat-content">
            <div className="stat-number admin-stat-number-wide">{formatCo2Value(summary.co2SavedKg)}</div>
            <div className="stat-label">CO2 Saved</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="admin-chart-panel">
          <div className="admin-panel-header">
            <div>
              <h3 className="admin-panel-title">Admin analytics unavailable</h3>
              <p className="admin-panel-subtitle">
                {error instanceof Error ? error.message : "Failed to load admin analytics."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={`admin-chart-grid admin-chart-grid-top focus-${topFocus}`}>
            <section
              className={`admin-chart-panel admin-chart-panel-wide admin-chart-panel-interactive ${topFocus === "left" ? "active" : ""}`}
              onClick={() => setTopFocus("left")}
            >
              <div className="admin-panel-header">
                <div>
                  <h3 className="admin-panel-title">Opportunities status overview</h3>
                  <p className="admin-panel-subtitle">Monthly opportunity status trends for {selectedYear}.</p>
                </div>
                <select className="admin-panel-select" value={opportunityFilter} onChange={(e) => setOpportunityFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="admin-inline-legend admin-inline-legend-light">
                {Object.values(OPPORTUNITY_LINES).map((line) => (
                  <span key={line.key} className="admin-legend-item">
                    <span className="admin-legend-swatch" style={{ background: line.color }} />
                    {line.label}
                  </span>
                ))}
              </div>
              <div className="admin-chart-area">
                {isLoading ? (
                  <EmptyState message="Loading opportunity analytics..." light />
                ) : opportunityData.length === 0 ? (
                  <EmptyState message="No opportunity data is available yet." light />
                ) : (
                  <ResponsiveContainer
                    {...responsiveChartProps}
                    onResize={updateChartDensity(setOpportunityChartDensity)}
                  >
                    <LineChart data={opportunityData} margin={opportunityLineChartConfig.margin}>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={opportunityLineChartConfig.xAxisTick}
                        {...opportunityLineChartConfig.xAxisProps}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={yAxisTick}
                        tickMargin={10}
                        width={opportunityLineChartConfig.yAxisWidth}
                        domain={[0, (dataMax) => Math.max(2, Math.ceil((dataMax || 0) + 1))]}
                      />
                      <Tooltip content={<MetricTooltip formatter={(value) => formatCount(value)} />} />
                      {visibleOpportunityLines.map((line) => (
                        <Line
                          key={line.key}
                          type="monotone"
                          dataKey={line.key}
                          name={line.label}
                          stroke={line.color}
                          strokeWidth={4}
                          dot={{ r: opportunityLineChartConfig.dotRadius, fill: line.color, stroke: "var(--surface-primary)", strokeWidth: 2 }}
                          activeDot={{ r: opportunityLineChartConfig.activeDotRadius }}
                          {...lineAnimationProps}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section
              className={`admin-chart-panel admin-chart-panel-compact admin-chart-panel-accent admin-chart-panel-interactive ${topFocus === "right" ? "active" : ""}`}
              onClick={() => setTopFocus("right")}
            >
              <div className="admin-panel-header admin-panel-header-accent">
                <div>
                  <h3 className="admin-panel-title">Pickup pipeline</h3>
                  <p className="admin-panel-subtitle">Total pickups and completed pickups by month.</p>
                </div>
              </div>
              <div className="admin-inline-legend">
                <span className="admin-legend-item"><span className="admin-legend-swatch" style={{ background: "#FACC15" }} />Scheduled</span>
                <span className="admin-legend-item"><span className="admin-legend-swatch" style={{ background: "#065F46" }} />Completed</span>
              </div>
              <div className="admin-chart-area admin-chart-area-accent">
                {isLoading ? (
                  <EmptyState message="Loading pickup analytics..." />
                ) : pickupData.length === 0 ? (
                  <EmptyState message="No pickup data is available yet." />
                ) : (
                  <ResponsiveContainer {...responsiveChartProps}>
                    <BarChart data={pickupData} layout="vertical" margin={barChartMargin}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.18)" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={accentAxisTick}
                        tickMargin={10}
                      />
                      <YAxis
                        dataKey="month"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={accentAxisTick}
                        width={48}
                      />
                      <Tooltip content={<MetricTooltip accent formatter={(value) => formatCount(value)} />} />
                      <Bar
                        dataKey="scheduled"
                        name="Scheduled"
                        fill="#FACC15"
                        radius={[0, 10, 10, 0]}
                        barSize={16}
                        {...barAnimationProps}
                      />
                      <Bar
                        dataKey="completed"
                        name="Completed"
                        fill="#065F46"
                        radius={[0, 10, 10, 0]}
                        barSize={16}
                        {...barAnimationProps}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>

          <div className={`admin-chart-grid admin-chart-grid-bottom focus-${bottomFocus}`}>
            <section
              className={`admin-chart-panel admin-chart-panel-wide admin-chart-panel-interactive ${bottomFocus === "left" ? "active" : ""}`}
              onClick={() => setBottomFocus("left")}
            >
              <div className="admin-panel-header">
                <div>
                  <h3 className="admin-panel-title">CO2 saved over time</h3>
                  <p className="admin-panel-subtitle">Monthly CO2 saved from completed schedules in {selectedYear}.</p>
                </div>
              </div>
              <div className="admin-chart-area">
                {isLoading ? (
                  <EmptyState message="Loading CO2 trend..." light />
                ) : co2LineData.length === 0 ? (
                  <EmptyState message="No completed pickup data is available yet." light />
                ) : (
                  <ResponsiveContainer
                    {...responsiveChartProps}
                    onResize={updateChartDensity(setCo2ChartDensity)}
                  >
                    <LineChart data={co2LineData} margin={co2LineChartConfig.margin}>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={co2LineChartConfig.xAxisTick}
                        {...co2LineChartConfig.xAxisProps}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={yAxisTick}
                        tickMargin={10}
                        width={co2LineChartConfig.yAxisWidth}
                        domain={[0, (dataMax) => Math.max(5, Math.ceil((dataMax || 0) * 1.15))]}
                      />
                      <Tooltip content={<MetricTooltip formatter={(value) => `${Number(value || 0).toFixed(2)} kg`} />} />
                      <Line
                        type="monotone"
                        dataKey="co2Saved"
                        name="CO2 Saved"
                        stroke="#0891B2"
                        strokeWidth={4}
                        dot={{ r: co2LineChartConfig.dotRadius, fill: "#0891B2", stroke: "var(--surface-primary)", strokeWidth: 2 }}
                        activeDot={{ r: co2LineChartConfig.activeDotRadius }}
                        {...lineAnimationProps}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section
              className={`admin-chart-panel admin-chart-panel-compact admin-chart-panel-interactive ${bottomFocus === "right" ? "active" : ""}`}
              onClick={() => setBottomFocus("right")}
            >
              <div className="admin-panel-header">
                <div>
                  <h3 className="admin-panel-title">CO2 by waste type</h3>
                  <p className="admin-panel-subtitle">Waste-type contribution for the selected month.</p>
                </div>
                <select className="admin-panel-select" value={pieMonth} onChange={(e) => setPieMonth(e.target.value)}>
                  {pieMonthOptions.map((month) => (
                    <option key={month} value={month}>
                      {month === "All" ? "All Months" : month}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-chart-area">
                {isLoading ? (
                  <EmptyState message="Loading waste breakdown..." light />
                ) : pieData.length === 0 ? (
                  <EmptyState message={`No CO2 breakdown found for ${pieMonth === "All" ? "this year" : pieMonth}.`} light />
                ) : (
                  <ResponsiveContainer
                    {...responsiveChartProps}
                    onResize={updateChartDensity(setPieChartDensity)}
                  >
                    <PieChart>
                      <Tooltip content={<MetricTooltip formatter={(value) => `${Number(value || 0).toFixed(2)} kg`} />} />
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={pieChartDensity === "tight" ? 46 : pieChartDensity === "compact" ? 58 : 68}
                        outerRadius={pieChartDensity === "tight" ? 76 : pieChartDensity === "compact" ? 94 : 112}
                        paddingAngle={3}
                        labelLine={pieChartDensity !== "tight"}
                        label={pieLabelRenderer}
                        {...pieAnimationProps}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={WASTE_COLORS[entry.name] || WASTE_COLORS.Other} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
