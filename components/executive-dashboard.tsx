// C:\Working\edr-new\components\executive-dashboard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, Legend,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';

// ─── Types ───────────────────────────────────────────────
interface DashboardData {
  totalAssets: number;
  totalValue: number;
  activePlans: number;
  openPOs: number;
  pendingClaims: number;
  overdueItems: number;
  byDepartment: { department: string; count: number; value: number }[];
  byStatus: { status: string; count: number }[];
  monthlyTrend: { month: string; created: number; completed: number }[];
  procurementPipeline: { stage: string; count: number; value: number }[];
  recentActivity: { id: string; action: string; actor: string; timestamp: string }[];
}

interface FilterState {
  unit: string;
  from: string;
  to: string;
  year: string;
}

// ─── Colors ──────────────────────────────────────────────
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  DRAFT: '#64748b',
  PENDING: '#f59e0b',
  APPROVED: '#2563eb',
  REJECTED: '#ef4444',
  COMPLETED: '#06b6d4',
  OVERDUE: '#f97316',
  CANCELLED: '#94a3b8',
};

// ─── KPI Card ────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string; icon: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl`} style={{ backgroundColor: `${color}15` }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function ExecutiveDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ unit: '', from: '', to: '', year: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.unit) params.set('unit', filters.unit);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.year) params.set('year', filters.year);

      const res = await fetch(`/api/dashboard?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');
      setData(json.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-500 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="font-medium">{error}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* ─── Header + Filters ─── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Smart Asset Management Overview</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Unit / Department"
            value={filters.unit}
            onChange={e => setFilters(f => ({ ...f, unit: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            type="date"
            value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filters.year}
            onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Years</option>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Assets" value={data.totalAssets.toLocaleString()} icon="📦" color="#2563eb" sub="All registered" />
        <KpiCard label="Total Value" value={`฿${(data.totalValue / 1_000_000).toFixed(1)}M`} icon="💰" color="#10b981" sub="Asset cost" />
        <KpiCard label="Active Plans" value={data.activePlans} icon="📋" color="#8b5cf6" sub="In progress" />
        <KpiCard label="Open POs" value={data.openPOs} icon="🛒" color="#f59e0b" sub="Pending" />
        <KpiCard label="Pending Claims" value={data.pendingClaims} icon="📝" color="#06b6d4" sub="To process" />
        <KpiCard label="Overdue" value={data.overdueItems} icon="⏰" color="#ef4444" sub="Attention" />
      </div>

      {/* ─── Charts Row 1 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets by Department */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Assets by Department</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.byDepartment}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="department" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Assets" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="value" name="Value (K฿)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Asset Status Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.byStatus}
                dataKey="count"
                nameKey="status"
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={100}
                paddingAngle={3}
              >
                {data.byStatus.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Charts Row 2 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Activity Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="created" name="Created" stroke="#2563eb" fill="#2563eb20" strokeWidth={2} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Procurement Pipeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Procurement Pipeline</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.procurementPipeline} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar dataKey="count" name="Count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="value" name="Value (K฿)" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Recent Activity ─── */}