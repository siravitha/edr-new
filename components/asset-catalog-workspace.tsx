// C:\Working\edr-new\components\asset-catalog-workspace.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface Asset {
  id: string;
  assetNo: string;
  name: string;
  department: string;
  cost: string;
  quantity: number;
  purchaseDate: string;
  status: string;
  notes?: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  RETIRED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Retired' },
};

export default function AssetCatalogWorkspace() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState({ assetNo: '', name: '', department: '', cost: '', quantity: '1', purchaseDate: '', notes: '' });
  const [formError, setFormError] = useState('');

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/assets?${params}`);
      const json = await res.json();
      if (json.success) {
        setAssets(json.data);
        setPagination(json.pagination);
      }
    } catch (e) {
      console.error('Failed to fetch assets', e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const url = editingAsset ? `/api/assets/${editingAsset.id}` : '/api/assets';
      const method = editingAsset ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          cost: form.cost ? parseFloat(form.cost) : 0,
          quantity: parseInt(form.quantity) || 1,
          purchaseDate: form.purchaseDate || new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setShowForm(false);
      setEditingAsset(null);
      setForm({ assetNo: '', name: '', department: '', cost: '', quantity: '1', purchaseDate: '', notes: '' });
      fetchAssets();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this asset?')) return;
    await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    fetchAssets();
  };

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setForm({
      assetNo: asset.assetNo,
      name: asset.name,
      department: asset.department || '',
      cost: String(asset.cost),
      quantity: String(asset.quantity),
      purchaseDate: asset.purchaseDate?.slice(0, 10) || '',
      notes: asset.notes || '',
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Asset Catalog</h1>
          <p className="text-sm text-gray-500">{pagination.total} assets</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingAsset(null); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + New Asset
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search asset no. or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="RETIRED">Retired</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Asset No.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Cost</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Qty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assets.map(asset => {
                const badge = STATUS_BADGES[asset.status] || STATUS_BADGES.ACTIVE;
                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{asset.assetNo}</td>
                    <td className="px-4 py-3 font-medium">{asset.name}</td>
                    <td className="px-4 py-3 text-gray-500">{asset.department}</td>
                    <td className="px-4 py-3 text-right">฿{Number(asset.cost).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{asset.quantity}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(asset)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                      <button onClick={() => handleDelete(asset.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                );
              })}
              {assets.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No assets found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-bold mb-4">{editingAsset ? 'Edit Asset' : 'New Asset'}</h2>
            {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Asset No. *</label>
                <input type="text" required value={form.assetNo} onChange={e => setForm(f => ({ ...f, assetNo: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" placeholder="AST-2026-0001" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Name *</label>
                <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" placeholder="Medical Equipment..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Department</label>
                  <input type="text" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Cost (฿)</label>
                  <input type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Quantity</label>
                  <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="mt-1 w-full px-