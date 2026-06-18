import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';

export default function Garages() {
  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  
  // Form State
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  const fetchGarages = async () => {
    setLoading(true);
    try {
      const response = await api.get('/garages');
      setGarages(response.data);
    } catch (err) {
      console.error('Failed to load garages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGarages();
  }, []);

  const openModal = (mode: 'create' | 'edit', garage?: any) => {
    setModalMode(mode);
    setError('');
    if (mode === 'create') {
      setSelectedId('');
      setName('');
      setIsActive(true);
    } else {
      if (!garage) return;
      setSelectedId(garage.id);
      setName(garage.name);
      setIsActive(garage.isActive);
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Garage name is required.');
      return;
    }

    try {
      if (modalMode === 'create') {
        await api.post('/garages', {
          name: name.trim(),
        });
      } else {
        await api.patch(`/garages/${selectedId}`, {
          name: name.trim(),
          isActive,
        });
      }
      setShowModal(false);
      fetchGarages();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save garage.');
    }
  };

  const handleDelete = async (id: string, garageName: string) => {
    if (!confirm(`Are you sure you want to delete garage ${garageName}?`)) return;
    try {
      await api.delete(`/garages/${id}`);
      fetchGarages();
    } catch (err) {
      console.error('Failed to delete garage:', err);
    }
  };

  const filtered = garages.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Service Garages</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage maintenance garages and service shop hubs.</p>
        </div>
        <button
          onClick={() => openModal('create')}
          className="flex items-center gap-2 bg-[#1a1f6e] hover:bg-[#151b4f] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md"
        >
          <Plus className="w-4 h-4" /> Create New Garage
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search garages by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/30 transition-all text-sm"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading garages...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold">
                  <th className="pb-3 px-4">Garage Name</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">{g.name}</td>
                    <td className="py-4 px-4">
                      {g.isActive ? (
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-500/20">Active</span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full text-xs font-bold border border-slate-200">Inactive</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openModal('edit', g)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/35 rounded-lg transition-colors"
                          title="Edit garage"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(g.id, g.name)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/35 rounded-lg transition-colors"
                          title="Delete garage"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modalMode === 'create' ? 'Create New Garage' : 'Edit Garage'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Garage Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sta. Rosa Terminal"
                required
              />
            </div>
            {modalMode === 'edit' && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-[#1a1f6e] focus:ring-[#1a1f6e]/30"
                />
                <Label htmlFor="isActive" className="cursor-pointer">Active Garage</Label>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1a1f6e] hover:bg-[#151b4f] text-white rounded-xl text-sm font-semibold"
              >
                Save
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
