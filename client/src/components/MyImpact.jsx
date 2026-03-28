import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useLocation } from "react-router-dom";
import { useMe, API_BASE } from "../Services/useMe";
import Loading from "./Loading";
import "../styles/NavbarComponents-styles/MyImpact.css";

// 1. Reusable Observer Hook
function useInView(options = { threshold: 0.4 }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect(); // Run once
      }
    }, options);

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options.threshold]);

  return [ref, isVisible];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WASTE_COLORS = {
  "Plastic": "#F59E0B",
  "Glass": "#3B82F6",
  "Paper": "#EAB308",
  "Electronic Waste": "#6366F1",
  "Organic Waste": "#22C55E",
  "Metal": "#6B7280",
  "Other": "#94A3B8"
};

const BlinkingDot = (props) => {
  const { cx, cy, index, dataLength, stroke, fill } = props;
  if (index === dataLength - 1) {
    return (
      <svg x={cx - 12} y={cy - 12} width={24} height={24}>
        <style>
          {`
            @keyframes ping {
              0% { transform: scale(0.6); opacity: 1; }
              100% { transform: scale(2); opacity: 0; }
            }
            .ping-circle { animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; transform-origin: center; }
          `}
        </style>
        <circle cx="12" cy="12" r="6" fill={stroke} opacity="0.4" className="ping-circle" />
        <circle cx="12" cy="12" r="5" fill={stroke} />
        <circle cx="12" cy="12" r="3" fill="#fff" />
      </svg>
    );
  }
  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="var(--surface-primary)" strokeWidth={2} />;
};

export default function MyImpact() {
  const { data: me } = useMe();
  const role = me?.role || "volunteer";
  const location = useLocation();
  const handledScrollTargetRef = useRef("");

  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();

  const [oppYear, setOppYear] = useState(currentYear);
  const [pickupYear, setPickupYear] = useState(currentYear);
  const [co2Year, setCo2Year] = useState(currentYear);

  const [co2ChartType, setCo2ChartType] = useState('line');
  const [pieMonth, setPieMonth] = useState("All");

  // Track active tab only via click now (no scroll listener)
  const [activeTab, setActiveTab] = useState('opportunities');

  const [oppRef, isOppVisible] = useInView({ threshold: 0.4 });
  const [pickupRef, isPickupVisible] = useInView({ threshold: 0.4 });
  const [co2Ref, isCo2Visible] = useInView({ threshold: 0.4 });

  const scrollToRef = (ref, tabName) => {
    setActiveTab(tabName);
    if (!(ref && ref.current)) return;

    const getScrollParent = (node) => {
      if (!node) return null;
      let parent = node.parentElement;
      while (parent) {
        const style = getComputedStyle(parent);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
        parent = parent.parentElement;
      }
      return window;
    };

    const topbar = document.querySelector('.topbar');
    const impactHeader = document.querySelector('.impact-header');
    const topbarHeight = topbar ? topbar.offsetHeight : 0;
    const impactHeaderHeight = impactHeader ? impactHeader.offsetHeight : 0;
    const extraSpacing = 12;
    const offset = topbarHeight + impactHeaderHeight + extraSpacing;

    const scrollParent = getScrollParent(ref.current);

    const refRect = ref.current.getBoundingClientRect();

    if (scrollParent === window) {
      const target = Math.max(0, refRect.top + window.pageYOffset - offset);
      window.scrollTo({ top: target, behavior: 'smooth' });
      return;
    }

    // scrollParent is an element
    const parentRect = scrollParent.getBoundingClientRect();
    const currentScrollTop = scrollParent.scrollTop;
    const relativeTop = refRect.top - parentRect.top;
    let target = currentScrollTop + relativeTop - offset;
    // clamp
    target = Math.max(0, Math.min(target, scrollParent.scrollHeight - scrollParent.clientHeight));
    scrollParent.scrollTo({ top: target, behavior: 'smooth' });
  };

  const { data: pickups, isLoading: loadingPickups } = useQuery({
    queryKey: ["pickups"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/pickup`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!me
  });

  const { data: opportunities, isLoading: loadingOpps } = useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/opportunities`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!me
  });

  const { data: myApplications, isLoading: loadingApps } = useQuery({
    queryKey: ["myApplications"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/applications/my`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!me && role === 'volunteer'
  });

  const isLoading = loadingPickups || loadingOpps || loadingApps;

  useEffect(() => {
    const target = location.state?.scrollToGraph || location.hash.replace("#", "");
    if (!target || isLoading) return;

    const scrollTargets = {
      opportunities_chart: { ref: oppRef, tab: "opportunities" },
      pickup_chart: { ref: pickupRef, tab: "pickup" },
      co2_chart: { ref: co2Ref, tab: "co2" },
    };

    const nextTarget = scrollTargets[target];
    if (!nextTarget?.ref?.current) return;

    const scrollKey = `${location.key || "impact"}:${target}`;
    if (handledScrollTargetRef.current === scrollKey) return;
    handledScrollTargetRef.current = scrollKey;

    window.setTimeout(() => {
      scrollToRef(nextTarget.ref, nextTarget.tab);
    }, 180);
  }, [location.hash, location.key, location.state, oppRef, pickupRef, co2Ref, isLoading]);

  const oppData = useMemo(() => {
    const data = MONTHS.map(m => ({ month: m, total: 0, specific: 0 }));
    if (!opportunities) return oppYear === currentYear ? data.slice(0, currentMonthIndex + 1) : data;

    opportunities.forEach(opp => {
      const d = new Date(opp.createdAt || opp.date || new Date());
      if (d.getFullYear() === oppYear && data[d.getMonth()]) {
        data[d.getMonth()].total += 1;
      }
    });

    if (role === 'volunteer') {
      if (myApplications) {
        myApplications.forEach(app => {
          if (app.status === 'accepted') {
            const opp = app.opportunityId || {};
            const d = new Date(app.createdAt || opp.createdAt || opp.date || new Date());
            if (d.getFullYear() === oppYear && data[d.getMonth()]) {
              data[d.getMonth()].specific += 1;
            }
          }
        });
      }
    } else {
      opportunities.forEach(opp => {
        const ownerId = opp.ngo_id?._id || opp.ngo_id || opp.NGO_ID;
        if (ownerId && String(ownerId) === String(me?.id || me?._id)) {
          const d = new Date(opp.createdAt || opp.date || new Date());
          if (d.getFullYear() === oppYear && data[d.getMonth()]) {
            data[d.getMonth()].specific += 1;
          }
        }
      });
    }
    return oppYear === currentYear ? data.slice(0, currentMonthIndex + 1) : data;
  }, [opportunities, myApplications, me, oppYear, role, currentMonthIndex]);

  const getFilteredPickups = (pickupsData) => {
    if (!pickupsData) return [];
    let filtered = pickupsData.filter(p => p.status === 'completed');
    if (role === 'ngo') {
      filtered = filtered.filter(p => p.ngoId && (String(p.ngoId._id) === String(me?.id || me?._id) || String(p.ngoId) === String(me?.id || me?._id)));
    }
    return filtered;
  };

  const pickupData = useMemo(() => {
    const data = MONTHS.map(m => ({ month: m, count: 0 }));
    const filteredPickups = getFilteredPickups(pickups);

    filteredPickups.forEach(p => {
      const d = new Date(p.updatedAt || p.createdAt || p.pickupDate);
      if (d.getFullYear() === pickupYear && data[d.getMonth()]) {
        data[d.getMonth()].count += 1;
      }
    });
    return pickupYear === currentYear ? data.slice(0, currentMonthIndex + 1) : data;
  }, [pickups, me, pickupYear, role, currentMonthIndex]);

  const co2LineData = useMemo(() => {
    const data = MONTHS.map(m => ({ month: m, co2: 0 }));
    const filteredPickups = getFilteredPickups(pickups);

    filteredPickups.forEach(p => {
      const d = new Date(p.updatedAt || p.createdAt || p.pickupDate);
      if (d.getFullYear() === co2Year && data[d.getMonth()]) {
        data[d.getMonth()].co2 += (p.co2Saved || 0);
      }
    });
    data.forEach(d => { d.co2 = Number(d.co2.toFixed(2)); });
    return co2Year === currentYear ? data.slice(0, currentMonthIndex + 1) : data;
  }, [pickups, me, co2Year, role, currentMonthIndex]);

  const co2PieData = useMemo(() => {
    const wasteMap = {};
    let filteredPickups = getFilteredPickups(pickups);

    if (pieMonth !== "All") {
      filteredPickups = filteredPickups.filter(p => {
        const d = new Date(p.updatedAt || p.createdAt || p.pickupDate);
        return d.getFullYear() === co2Year && MONTHS[d.getMonth()] === pieMonth;
      });
    } else {
      filteredPickups = filteredPickups.filter(p => {
        return new Date(p.updatedAt || p.createdAt || p.pickupDate).getFullYear() === co2Year;
      });
    }

    filteredPickups.forEach(p => {
      if (p.co2Saved > 0) {
        wasteMap[p.wasteType] = (wasteMap[p.wasteType] || 0) + p.co2Saved;
      }
    });

    return Object.keys(wasteMap).map(type => ({
      name: type,
      value: Number(wasteMap[type].toFixed(2))
    })).filter(x => x.value > 0);
  }, [pickups, me, co2Year, pieMonth, role]);

  if (isLoading) return <Loading isLoading={true} />;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--tooltip-bg)', padding: '12px 16px', borderRadius: '12px', boxShadow: 'var(--shadow-soft)', border: '1px solid var(--border-color)' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--tooltip-text)' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color, margin: '4px 0', fontSize: '14px', fontWeight: 500 }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({ name }) => {
    return name;
  };

  const YearSelect = ({ value, onChange }) => (
    <select className="select-month" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      <option value={currentYear}>{currentYear}</option>
      <option value={currentYear - 1}>{currentYear - 1}</option>
    </select>
  );

  return (
    <div className="impact-page page">

      <div style={{ textAlign: "center", marginBottom: "8px", marginTop: "10px" }}>
        <h1 style={{ fontWeight: 400, fontSize: "36px", color: "var(--text-primary)", letterSpacing: "1px", margin: 0 }}>My Impact</h1>
        <p style={{ fontWeight: 400, fontSize: "16px", color: "var(--text-muted)", margin: "8px 0 0" }}>A complete overview of your environmental footprint</p>
      </div>

      <div className="impact-header">
        <button
          className={`impact-toggle-btn ${activeTab === 'opportunities' ? 'active' : ''}`}
          onClick={() => scrollToRef(oppRef, 'opportunities')}
        >
          Opportunities
        </button>
        <button
          className={`impact-toggle-btn ${activeTab === 'pickup' ? 'active' : ''}`}
          onClick={() => scrollToRef(pickupRef, 'pickup')}
        >
          Pickup
        </button>
        <button
          className={`impact-toggle-btn ${activeTab === 'co2' ? 'active' : ''}`}
          onClick={() => scrollToRef(co2Ref, 'co2')}
        >
          CO₂ Saved
        </button>
      </div>

      <div style={{ padding: '0 8px' }}>
        {/* Graph 1: Opportunities */}
        <div className="chart-section" ref={oppRef} id="opportunities_chart">
          <div className="chart-header">
            <div>
              <h2 className="chart-title">Opportunities</h2>
              <p className="chart-subtitle" style={{ color: "var(--primary)" }}>Statistics for the selected year</p>
            </div>
            <div>
              <YearSelect value={oppYear} onChange={setOppYear} />
            </div>
          </div>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <BarChart key={`opp-${oppYear}-${isOppVisible}-${activeTab}`} data={oppData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-text)', fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-text)', fontWeight: 500 }} dx={-10} allowDecimals={false} />
                <Tooltip cursor={false} content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar
                  isAnimationActive={isOppVisible}
                  dataKey="total"
                  name="Total Opportunities"
                  fill="#0F766E"
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                />
                <Bar
                  isAnimationActive={isOppVisible}
                  dataKey="specific"
                  name={role === 'volunteer' ? "Opportunities Joined" : "Your Opportunities"}
                  fill="#08C18A"
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Pickups */}
        <div className="chart-section" ref={pickupRef} id="pickup_chart">
          <div className="chart-header">
            <div>
              <h2 className="chart-title">Pickups</h2>
              <p className="chart-subtitle" style={{ color: "var(--primary)" }}>Completed pickups for the selected year</p>
            </div>
            <div>
              <YearSelect value={pickupYear} onChange={setPickupYear} />
            </div>
          </div>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <LineChart key={`pickup-${pickupYear}-${isPickupVisible}-${activeTab}`} data={pickupData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-text)', fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-text)', fontWeight: 500 }} dx={-10} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line
                  isAnimationActive={isPickupVisible}
                  type="linear"
                  dataKey="count"
                  name="Completed Pickups"
                  stroke="#08C18A"
                  strokeWidth={4}
                  dot={(props) => <BlinkingDot {...props} dataLength={pickupData.length} fill="#08C18A" />}
                  activeDot={{ r: 8, fill: '#08C18A', stroke: 'var(--surface-primary)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 3: CO2 Saved */}
        <div className="chart-section" ref={co2Ref} id="co2_chart">
          <div className="chart-header" style={{ alignItems: 'flex-start' }}>
            <div>
              <h2 className="chart-title">CO₂ Saved</h2>
              <p className="chart-subtitle" style={{ color: "var(--primary)" }}>Explore the environmental impact of your activities</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-end' }}>
              <div className="radio-group">
                <div
                  className={`radio-label ${co2ChartType === 'line' ? 'active' : ''}`}
                  onClick={() => setCo2ChartType('line')}
                >
                  Line Chart
                </div>
                <div
                  className={`radio-label ${co2ChartType === 'pie' ? 'active' : ''}`}
                  onClick={() => setCo2ChartType('pie')}
                >
                  Pie Chart
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <YearSelect value={co2Year} onChange={setCo2Year} />

                {co2ChartType === 'pie' && (
                  <select
                    className="select-month"
                    value={pieMonth}
                    onChange={(e) => setPieMonth(e.target.value)}
                  >
                    <option value="All">All Months</option>
                    {MONTHS.map((m, idx) => (
                      (co2Year !== currentYear || idx <= currentMonthIndex) && <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              {co2ChartType === 'line' ? (
                <LineChart key={`co2-line-${co2Year}-${isCo2Visible}-${activeTab}`} data={co2LineData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-text)', fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--chart-text)', fontWeight: 500 }} dx={-10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Line
                    isAnimationActive={isCo2Visible}
                    type="linear"
                    dataKey="co2"
                    name="CO₂ Saved (kg)"
                    stroke="#08C18A"
                    strokeWidth={4}
                    dot={(props) => <BlinkingDot {...props} dataLength={co2LineData.length} fill="#08C18A" />}
                    activeDot={{ r: 8, fill: 'var(--text-primary)', stroke: 'var(--surface-primary)' }}
                  />
                </LineChart>
              ) : (
                <PieChart>
                  <Pie
                    isAnimationActive={isCo2Visible}
                    data={co2PieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={90}
                    outerRadius={140}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                    label={renderCustomizedLabel}
                  >
                    {co2PieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={WASTE_COLORS[entry.name] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} kg`, 'CO₂ Saved']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', background: 'var(--tooltip-bg)', color: 'var(--tooltip-text)' }}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
            {co2ChartType === 'pie' && co2PieData.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: '-200px', color: 'var(--text-muted)', fontWeight: 500 }}>
                No completed pickups with CO₂ data for {pieMonth === "All" ? co2Year : `${pieMonth} ${co2Year}`}.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
