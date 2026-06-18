import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';

export default function Drivers() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  
  // Form State
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/drivers');
      setDrivers(response.data);
    } catch (err) {
      console.error('Failed to load drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const openModal = (mode: 'create' | 'edit', driver?: any) => {
    setModalMode(mode);
    setError('');
    if (mode === 'create') {
      setSelectedId('');
      setName('');
      setLicenseNumber('');
      setIsVerified(false);
      setIsActive(true);
    } else {
      if (!driver) return;
      setSelectedId(driver.id);
      setName(driver.name);
      setLicenseNumber(driver.licenseNumber);
      setIsVerified(driver.isVerified);
      setIsActive(driver.isActive);
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !licenseNumber.trim()) {
      setError('Driver name and license number are required.');
      return;
    }

    try {
      if (modalMode === 'create') {
        await api.post('/drivers', {
          name: name.trim(),
          licenseNumber: licenseNumber.trim(),
          isVerified,
        });
      } else {
        await api.patch(`/drivers/${selectedId}`, {
          name: name.trim(),
          licenseNumber: licenseNumber.trim(),
          isVerified,
          isActive,
        });
      }
      setShowModal(false);
      fetchDrivers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save driver.');
    }
  };

  const handleDelete = async (id: string, driverName: string) => {
    if (!confirm(`Are you sure you want to delete driver ${driverName}?`)) return;
    try {
      await api.delete(`/drivers/${id}`);
      fetchDrivers();
    } catch (err) {
      console.error('Failed to delete driver:', err);
    }
  };

  const filtered = drivers.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.licenseNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Drivers Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage logistics truck drivers and credential verifications.</p>
        </div>
        <button
          onClick={() => openModal('create')}
          className="flex items-center gap-2 bg-[#1a1f6e] hover:bg-[#151b4f] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md"
        >
          <Plus className="w-4 h-4" /> Create New Driver
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search drivers by name or license..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/30 transition-all text-sm"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading drivers...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold">
                  <th className="pb-3 px-4">Driver Name</th>
                  <th className="pb-3 px-4">License Number</th>
                  <th className="pb-3 px-4">Verification</th>
                  <th className="pb-3 px-4">Active</th>
                  <th className="pb-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">{d.name}</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-slate-300 font-semibold uppercase">{d.licenseNumber}</td>
                    <td className="py-4 px-4">
                      {d.isVerified ? (
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-500/20">Verified</span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-500/20">Pending</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {d.isActive ? (
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-500/20">Active</span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full text-xs font-bold border border-slate-200">Inactive</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openModal('edit', d)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/35 rounded-lg transition-colors"
                          title="Edit driver"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(d.id, d.name)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/35 rounded-lg transition-colors"
                          title="Delete driver"
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
            <DialogTitle>{modalMode === 'create' ? 'Create New Driver' : 'Edit Driver'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Driver Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Danilo Ramos"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input
                id="licenseNumber"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="e.g. DL-RAMOS-1234"
                required
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                id="isVerified"
                type="checkbox"
                checked={isVerified}
                onChange={(e) => setIsVerified(e.target.checked)}
                className="rounded border-slate-300 text-[#1a1f6e] focus:ring-[#1a1f6e]/30"
              />
              <Label htmlFor="isVerified" className="cursor-pointer">License Verified</Label>
            </div>
            {modalMode === 'edit' && (
              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-[#1a1f6e] focus:ring-[#1a1f6e]/30"
                />
                <Label htmlFor="isActive" className="cursor-pointer">Active Status</Label>
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
