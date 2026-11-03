"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { cn, formatCurrency } from "../lib/utils";

type AssetStatus = "AVAILABLE" | "IN_USE" | "REPAIR" | "QUARANTINED" | "DISPOSED";

interface Asset {
  id: string;
  hospitalId: string;
  wardId: string;
  assetNo: string;
  name: string;
  status: AssetStatus;
  version: number;
  needsReview: boolean;
  cost: string | number;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "AVAILABLE", label: "Available" },
  { value: "IN_USE", label: "In use" },
  { value: "REPAIR", label: "Repair" },
  { value: "QUARANTINED", label: "Quarantined" },
  { value: "DISPOSED", label: "Disposed" },
];

const WARD_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All wards" },
  { value: "W1", label: "Ward 1" },
  { value: "W2", label: "Ward 2" },
  { value: "W3", label: "Ward 3" },
  { value: "W4", label: "Ward 4" },
  { value: "W5", label: "Ward 5" },
];

const HOSPITAL_ID = "H1";
const PAGE_SIZE = 10;

const statusStyles: Record<AssetStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  IN_USE: "bg-blue-100 text-blue-700",
  REPAIR: "bg-yellow-100 text-yellow-700",
  QUARANTINED: "bg-orange-100 text-orange-700",
  DISPOSED: "bg-gray-100 text-gray-600",
};

const statusLabels: Record<AssetStatus, string> = {
  AVAILABLE: "Available",
  IN_USE: "In use",
  REPAIR: "Repair",
  QUARANTINED: "Quarantined",
  DISPOSED: "Disposed",
};

export interface AssetCatalogWorkspaceProps {
  role?: string;
  editable?: boolean;
  proposals?: unknown[];
  onPropose?: (proposal: CatalogProposal) => Promise<boolean> | boolean | void;
}

export function AssetCatalogWorkspace(_props: AssetCatalogWorkspaceProps = {}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [wardFilter, setWardFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (wardFilter) params.set("wardId", wardFilter);
      const res = await fetch(`/api/assets?${params.toString()}`);
      const data = await res.json();
      setAssets(data.assets || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูลสินทรัพย์ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, wardFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchAssets(), 300);
    return () => clearTimeout(t);
  }, [fetchAssets]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    form.forEach((val, key) => { payload[key] = val; });
    if (payload.cost !== undefined && payload.cost !== "") payload.cost = Number(payload.cost);
    setError(""); setSuccess(""); setSaving(true);
    try {
      const res = editing
        ? await fetch(`/api/assets/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, hospitalId: HOSPITAL_ID }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `คำขอไม่สำเร็จ (รหัสสถานะ ${res.status})`);
      }
      setSuccess(editing ? "แก้ไขสินทรัพย์เรียบร้อยแล้ว" : "สร้างสินทรัพย์เรียบร้อยแล้ว");
      setShowForm(false);
      setEditing(null);
      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`ยืนยันการลบสินทรัพย์ "${name}" ?`)) return;
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("การลบสินทรัพย์ไม่สำเร็จ");
      setSuccess("ลบสินทรัพย์เรียบร้อยแล้ว");
      fetchAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "การลบสินทรัพย์ไม่สำเร็จ");
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setError("");
    setSuccess("");
    try {
      const params = new URLSearchParams({ hospitalId: HOSPITAL_ID });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (wardFilter) params.set("wardId", wardFilter);
      const res = await fetch(`/api/reports/assets-pdf?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        throw new Error(String(data.error || `การส่งออกเอกสาร PDF ไม่สำเร็จ (รหัสสถานะ ${res.status})`));
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const m = disposition.match(/filename\*?=([^;]+)/i);
      const filename = (m ? decodeURIComponent(m[1].replace(/"/g, "").trim()) : null) || `assets-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSuccess("ส่งออกเอกสาร PDF เรียบร้อยแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "การส่งออกเอกสาร PDF ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  const handleEdit = (asset: Asset) => { setEditing(asset); setShowForm(true); setError(""); setSuccess(""); };
  const handleNew = () => { setEditing(null); setShowForm(true); setError(""); setSuccess(""); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const statusBadge = (s: AssetStatus) => (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusStyles[s] || "bg-blue-100 text-blue-700")}>
      {statusLabels[s] || s}
    </span>
  );

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asset Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">Search, filter, and manage hospital assets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? "Exporting..." : "Export PDF"}
          </Button>
          <Button onClick={handleNew}>+ New Asset</Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <input
            type="search"
            placeholder="Search asset code or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 flex-1 min-w-[220px] rounded-md border px-3 text-sm bg-background"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-md border px-3 text-sm bg-background"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={wardFilter}
            onChange={(e) => { setWardFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-md border px-3 text-sm bg-background"
          >
            {WARD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="text-sm text-muted-foreground whitespace-nowrap">{total} items</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">กำลังโหลดข้อมูล...</div>
          ) : assets.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
              <p>ไม่พบข้อมูลสินทรัพย์</p>
              <Button variant="secondary" onClick={handleNew}>สร้างสินทรัพย์แรก</Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Asset No</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="hidden md:table-cell px-3 py-2 font-medium">Ward</th>
                      <th className="hidden md:table-cell px-3 py-2 font-medium text-right">Cost</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="hidden md:table-cell px-3 py-2 font-medium">Version</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-mono text-xs">{asset.assetNo}</td>
                        <td className="px-3 py-2 font-medium">{asset.name}</td>
                        <td className="hidden md:table-cell px-3 py-2">{asset.wardId || "-"}</td>
                        <td className="hidden md:table-cell px-3 py-2 text-right">{formatCurrency(Number(asset.cost) || 0)}</td>
                        <td className="px-3 py-2">{statusBadge(asset.status)}</td>
                        <td className="hidden md:table-cell px-3 py-2 text-center text-xs text-muted-foreground">v{asset.version}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(asset)}>Edit</Button>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(asset.id, asset.name)}>Del</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  Showing {from}&ndash;{to} of {total}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    &larr; Prev
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    Page {page} / {totalPages}
                  </span>
                  <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    Next &rarr;
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeForm}>
          <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">{editing ? "Edit Asset" : "New Asset"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Asset Code <span className="text-red-500">*</span></label>
                  <input name="assetNo" required defaultValue={editing?.assetNo} disabled={!!editing} placeholder="AST-2569-0001"
                    className="w-full h-9 rounded-md border px-3 text-sm disabled:opacity-50" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Name <span className="text-red-500">*</span></label>
                  <input name="name" required defaultValue={editing?.name} placeholder="Air Conditioner 18,000 BTU"
                    className="w-full h-9 rounded-md border px-3 text-sm" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Ward</label>
                  <select name="wardId" defaultValue={editing?.wardId || ""}
                    className="w-full h-9 rounded-md border px-3 text-sm bg-background">
                    {WARD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <select name="status" defaultValue={editing?.status || "AVAILABLE"}
                    className="w-full h-9 rounded-md border px-3 text-sm bg-background">
                    {STATUS_OPTIONS.filter(o => o.value !== "").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Cost (THB)</label>
                <input name="cost" type="number" min="0" step="0.01" defaultValue={editing ? Number(editing.cost) : ""}
                  placeholder="45000" className="w-full h-9 rounded-md border px-3 text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create Asset"}
                </Button>
                <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export interface CatalogProposal {
    catalogId: string;
    createdAt: string;
}

export default AssetCatalogWorkspace;