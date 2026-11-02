"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { cn, formatCurrency } from "../lib/utils";

interface Asset {
  id: string;
  assetNumber: string;
  assetName: string;
  assetCategory: string;
  department: string;
  location: string;
  quantity: number;
  unitPrice: number;
  supplier: string;
  purchaseDate: string;
  fiscalYear: string;
  status: string;
  notes: string;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "เน€เธโ€”เน€เธเธเน€เธยเน€เธเธเน€เธโ€“เน€เธเธ’เน€เธยเน€เธเธ" },
  { value: "ACTIVE", label: "เน€เธยเน€เธยเน€เธยเน€เธยเน€เธเธ’เน€เธยเน€เธเธเน€เธเธเน€เธเธเน€เธย" },
  { value: "RETIRED", label: "เน€เธยเน€เธเธ…เน€เธโ€เน€เธเธเน€เธเธเน€เธเธเน€เธเธ’เน€เธย" },
  { value: "MAINTENANCE", label: "เน€เธยเน€เธเธ“เน€เธเธ…เน€เธเธ‘เน€เธยเน€เธยเน€เธยเน€เธเธเน€เธเธ" },
];

export function AssetCatalogWorkspace() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "10" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/assets?${params}`);
      const data = await res.json();
      setAssets(data.assets);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setError("เน€เธยเน€เธเธเน€เธเธ…เน€เธโ€เน€เธยเน€เธยเน€เธเธเน€เธเธเน€เธเธเน€เธเธ…เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธโ€เน€เธย");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchAssets(), 300);
    return () => clearTimeout(t);
  }, [fetchAssets]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    form.forEach((val, key) => { payload[key] = val; });
    if (payload.quantity) payload.quantity = Number(payload.quantity);
    if (payload.unitPrice) payload.unitPrice = Number(payload.unitPrice);
    setError(""); setSuccess(""); setSaving(true);

    try {
      const res = editing
        ? await fetch(`/api/assets/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }
      setSuccess(editing ? "เน€เธเธเน€เธเธ‘เน€เธยเน€เธโฌเน€เธโ€เน€เธโ€ขเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธเธ…เน€เธยเน€เธเธ" : "เน€เธเธเน€เธเธเน€เธยเน€เธเธ’เน€เธยเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธยเน€เธเธเน€เธเธ“เน€เธโฌเน€เธเธเน€เธยเน€เธย");
      setShowForm(false); setEditing(null);
      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เน€เธโฌเน€เธยเน€เธเธ”เน€เธโ€เน€เธยเน€เธยเน€เธเธเน€เธยเน€เธเธ”เน€เธโ€เน€เธยเน€เธเธ…เน€เธเธ’เน€เธโ€");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`เน€เธเธ…เน€เธยเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธย "${name}" ?`)) return;
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("เน€เธเธ…เน€เธยเน€เธยเน€เธเธเน€เธยเน€เธยเน€เธโ€เน€เธย");
      setSuccess("เน€เธเธ…เน€เธยเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธเธ…เน€เธยเน€เธเธ");
      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เน€เธเธ…เน€เธยเน€เธยเน€เธเธเน€เธยเน€เธยเน€เธโ€เน€เธย");
    }
  };

  const handleEdit = (asset: Asset) => { setEditing(asset); setShowForm(true); setError(""); setSuccess(""); };
  const handleNew = () => { setEditing(null); setShowForm(true); setError(""); setSuccess(""); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { ACTIVE: "bg-green-100 text-green-700", RETIRED: "bg-gray-100 text-gray-600", MAINTENANCE: "bg-yellow-100 text-yellow-700" };
    const label: Record<string, string> = { ACTIVE: "เน€เธยเน€เธยเน€เธยเน€เธยเน€เธเธ’เน€เธย", RETIRED: "เน€เธยเน€เธเธ…เน€เธโ€เน€เธเธเน€เธเธเน€เธเธเน€เธเธ’เน€เธย", MAINTENANCE: "เน€เธยเน€เธยเน€เธเธเน€เธเธ" };
    return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", map[s] || "bg-blue-100 text-blue-700")}>{label[s] || s}</span>;
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">เน€เธโ€”เน€เธเธเน€เธโฌเน€เธยเน€เธเธ•เน€เธเธเน€เธยเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธย</h1>
          <p className="text-sm text-muted-foreground mt-1">เน€เธยเน€เธเธ‘เน€เธโ€เน€เธยเน€เธเธ’เน€เธเธเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธย เนโฌโ€ เน€เธโฌเน€เธยเน€เธเธ”เน€เธยเน€เธเธ / เน€เธยเน€เธยเน€เธยเน€เธยเน€เธย / เน€เธเธ…เน€เธย / เน€เธยเน€เธยเน€เธยเน€เธเธเน€เธเธ’</p>
        </div>
        <Button onClick={handleNew}>+ เน€เธโฌเน€เธยเน€เธเธ”เน€เธยเน€เธเธเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธย</Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <input type="search" placeholder="เน€เธยเน€เธยเน€เธยเน€เธเธเน€เธเธ’ เน€เธเธเน€เธเธเน€เธเธ’เน€เธเธเน€เธโฌเน€เธเธ…เน€เธย / เน€เธยเน€เธเธ—เน€เธยเน€เธเธ / เน€เธยเน€เธยเน€เธยเน€เธย / เน€เธเธเน€เธโ€“เน€เธเธ’เน€เธยเน€เธโ€”เน€เธเธ•เน€เธย..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 flex-1 min-w-[200px] rounded-md border px-3 text-sm bg-background" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-md border px-3 text-sm bg-background">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="text-sm text-muted-foreground whitespace-nowrap">{total} เน€เธเธเน€เธเธ’เน€เธเธเน€เธยเน€เธเธ’เน€เธเธ</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle>เน€เธเธเน€เธเธ’เน€เธเธเน€เธยเน€เธเธ’เน€เธเธเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธย</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">เน€เธยเน€เธเธ“เน€เธเธ…เน€เธเธ‘เน€เธยเน€เธยเน€เธเธเน€เธเธ…เน€เธโ€...</div>
          ) : assets.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
              <p>เน€เธเธเน€เธเธ‘เน€เธยเน€เธยเน€เธเธเน€เธยเน€เธเธเน€เธเธ•เน€เธยเน€เธยเน€เธเธเน€เธเธเน€เธเธเน€เธเธ…</p>
              <Button variant="secondary" onClick={handleNew}>เน€เธโฌเน€เธยเน€เธเธ”เน€เธยเน€เธเธเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธเธเน€เธย</Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">เน€เธเธเน€เธเธเน€เธเธ’เน€เธเธเน€เธโฌเน€เธเธ…เน€เธย</th>
                      <th className="px-3 py-2 font-medium">เน€เธยเน€เธเธ—เน€เธยเน€เธเธ</th>
                      <th className="px-3 py-2 font-medium">เน€เธยเน€เธยเน€เธยเน€เธย</th>
                      <th className="px-3 py-2 font-medium">เน€เธเธเน€เธโ€“เน€เธเธ’เน€เธยเน€เธโ€”เน€เธเธ•เน€เธย</th>
                      <th className="px-3 py-2 font-medium text-right">เน€เธเธเน€เธเธ’เน€เธยเน€เธเธ’</th>
                      <th className="px-3 py-2 font-medium">เน€เธเธเน€เธโ€“เน€เธเธ’เน€เธยเน€เธเธ</th>
                      <th className="px-3 py-2 font-medium">เน€เธยเน€เธเธ•เน€เธยเน€เธย</th>
                      <th className="px-3 py-2 font-medium text-right">เน€เธยเน€เธเธ‘เน€เธโ€เน€เธยเน€เธเธ’เน€เธเธ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map(asset => (
                      <tr key={asset.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-mono text-xs">{asset.assetNumber}</td>
                        <td className="px-3 py-2 font-medium">{asset.assetName}</td>
                        <td className="px-3 py-2">{asset.department || "เนโฌโ€"}</td>
                        <td className="px-3 py-2">{asset.location || "เนโฌโ€"}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(asset.unitPrice)}</td>
                        <td className="px-3 py-2">{statusBadge(asset.status)}</td>
                        <td className="px-3 py-2">{asset.fiscalYear}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(asset)}>เน€เธยเน€เธยเน€เธยเน€เธยเน€เธย</Button>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(asset.id, asset.assetName)}>เน€เธเธ…เน€เธย</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>เนยย เน€เธยเน€เธยเน€เธเธเน€เธยเน€เธเธเน€เธยเน€เธยเน€เธเธ’</Button>
                  <span className="text-sm text-muted-foreground">เน€เธเธเน€เธยเน€เธยเน€เธเธ’ {page} / {totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>เน€เธโ€“เน€เธเธ‘เน€เธโ€เน€เธยเน€เธย เนยโ€</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">{editing ? "เน€เธยเน€เธยเน€เธยเน€เธยเน€เธยเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธย" : "เน€เธโฌเน€เธยเน€เธเธ”เน€เธยเน€เธเธเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธย"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">เน€เธเธเน€เธเธเน€เธเธ’เน€เธเธเน€เธโฌเน€เธเธ…เน€เธย * <span className="text-red-500">*</span></label>
                  <input name="assetNumber" required defaultValue={editing?.assetNumber} placeholder="AST-2569-0001"
                    className="w-full h-9 rounded-md border px-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">เน€เธยเน€เธเธ—เน€เธยเน€เธเธเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธย *</label>
                  <input name="assetName" required defaultValue={editing?.assetName} placeholder="เน€เธโฌเน€เธยเน€เธเธเน€เธเธ—เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธเธ’เน€เธยเน€เธเธ’เน€เธเธ 18,000 BTU"
                    className="w-full h-9 rounded-md border px-3 text-sm" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">เน€เธยเน€เธเธเน€เธเธเน€เธโฌเน€เธย เน€เธโ€”</label>
                  <input name="assetCategory" defaultValue={editing?.assetCategory} placeholder="เน€เธยเน€เธเธเน€เธเธเน€เธย เน€เธเธ‘เน€เธโ€เน€เธโ€เน€เธย / เน€เธโฌเน€เธยเน€เธเธเน€เธเธ—เน€เธยเน€เธเธเน€เธยเน€เธเธเน€เธเธ—เน€เธเธเน€เธยเน€เธยเน€เธโ€”เน€เธเธเน€เธย"
                    className="w-full h-9 rounded-md border px-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">เน€เธยเน€เธยเน€เธยเน€เธย</label>
                  <input name="department" defaultValue={editing?.department} placeholder="เน€เธเธเน€เธเธเน€เธเธเน€เธยเน€เธโ€ 5 เน€เธยเน€เธเธ‘เน€เธยเน€เธย 3"
                    className="w-full h-9 rounded-md border px-3 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">เน€เธเธเน€เธโ€“เน€เธเธ’เน€เธยเน€เธโ€”เน€เธเธ•เน€เธยเน€เธโ€ขเน€เธเธ”เน€เธโ€เน€เธโ€ขเน€เธเธ‘เน€เธยเน€เธย</label>
                <input name="location" defaultValue={editing?.location} placeholder="เน€เธเธเน€เธเธ’เน€เธยเน€เธเธ’เน€เธเธเน€เธยเน€เธเธเน€เธยเน€เธยเน€เธยเน€เธเธเน€เธเธ เน€เธยเน€เธเธ‘เน€เธยเน€เธย 5 เน€เธเธเน€เธยเน€เธเธเน€เธย 502"
                  className="w-full h-9 rounded-md border px-3 text-sm" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">เน€เธยเน€เธเธ“เน€เธยเน€เธเธเน€เธย</label>
                  <input name="quantity" type="number" min="1" defaultValue={editing?.quantity ?? 1}
                    className="w-full h-9 rounded-md border px-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">เน€เธเธเน€เธเธ’เน€เธยเน€เธเธ’เน€เธโ€ขเน€เธยเน€เธเธเน€เธเธเน€เธยเน€เธยเน€เธเธเน€เธเธ</label>
                  <input name="unitPrice" type="number" min="0" step="0.01" defaultValue={editing?.unitPrice ?? 0}
                    className="w-full h-9 rounded-md border px-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">เน€เธยเน€เธเธ•เน€เธยเน€เธยเน€เธยเน€เธเธเน€เธเธเน€เธเธเน€เธเธ’เน€เธโ€</label>
                  <input name="fiscalYear" defaultValue={editing?.fiscalYear || "2569"} placeholder="2569"
                    className="w-full h-9 rounded-md border px-3 text-sm" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">เน€เธยเน€เธเธเน€เธยเน€เธยเน€เธเธ’เน€เธเธ</label>
                  <input name="supplier" defaultValue={editing?.supplier} placeholder="เน€เธยเน€เธเธเน€เธเธ”เน€เธเธเน€เธเธ‘เน€เธโ€” ..."
                    className="w-full h-9 rounded-md border px-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">เน€เธเธเน€เธเธ‘เน€เธยเน€เธโ€”เน€เธเธ•เน€เธยเน€เธยเน€เธเธ—เน€เธยเน€เธเธ</label>
                  <input name="purchaseDate" type="date" defaultValue={editing ? editing.purchaseDate?.substring(0, 10) : ""}
                    className="w-full h-9 rounded-md border px-3 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">เน€เธเธเน€เธโ€“เน€เธเธ’เน€เธยเน€เธเธ</label>
                <select name="status" defaultValue={editing?.status || "ACTIVE"} className="w-full h-9 rounded-md border px-3 text-sm bg-background">
                  <option value="ACTIVE">เน€เธยเน€เธยเน€เธยเน€เธยเน€เธเธ’เน€เธยเน€เธเธเน€เธเธเน€เธเธเน€เธย</option>
                  <option value="MAINTENANCE">เน€เธยเน€เธเธ“เน€เธเธ…เน€เธเธ‘เน€เธยเน€เธยเน€เธยเน€เธเธเน€เธเธ</option>
                  <option value="RETIRED">เน€เธยเน€เธเธ…เน€เธโ€เน€เธเธเน€เธเธเน€เธเธเน€เธเธ’เน€เธย</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">เน€เธเธเน€เธเธเน€เธเธ’เน€เธเธเน€เธโฌเน€เธเธเน€เธโ€ขเน€เธเธ</label>
                <textarea name="notes" rows={2} defaultValue={editing?.notes} placeholder="เน€เธเธเน€เธเธ’เน€เธเธเน€เธเธ…เน€เธเธเน€เธโฌเน€เธเธเน€เธเธ•เน€เธเธเน€เธโ€เน€เธโฌเน€เธยเน€เธเธ”เน€เธยเน€เธเธเน€เธโฌเน€เธโ€ขเน€เธเธ”เน€เธเธ..."
                  className="w-full rounded-md border px-3 text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "เน€เธยเน€เธเธ“เน€เธเธ…เน€เธเธ‘เน€เธยเน€เธยเน€เธเธ‘เน€เธยเน€เธโ€”เน€เธเธ–เน€เธย..." : editing ? "เน€เธยเน€เธเธ‘เน€เธยเน€เธโ€”เน€เธเธ–เน€เธยเน€เธยเน€เธเธ’เน€เธเธเน€เธยเน€เธยเน€เธยเน€เธยเน€เธย" : "เน€เธเธเน€เธเธเน€เธยเน€เธเธ’เน€เธยเน€เธเธเน€เธเธ”เน€เธยเน€เธโ€”เน€เธเธเน€เธเธ‘เน€เธยเน€เธเธเน€เธย"}
                </Button>
                <Button type="button" variant="secondary" onClick={closeForm}>เน€เธเธเน€เธยเน€เธโฌเน€เธเธ…เน€เธเธ”เน€เธย</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export interface CatalogProposal {
  id: string;
  name: string;
  category: string;
  proposedBy: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}
