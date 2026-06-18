import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  
  // Form State
  const [selectedId, setSelectedId] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [model, setModel] = useState('');
  const [odometer, setOdometer] = useState<number | string>(0);
  const [status, setStatus] = useState('AVAILABLE');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const response = await api.get('/vehicles');
      setVehicles(response.data);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const openModal = (mode: 'create' | 'edit', vehicle?: any) => {
    setModalMode(mode);
    setError('');
    if (mode === 'create') {
      setSelectedId('');
      setPlateNumber('');
      setModel('');
      setOdometer(0);
      setStatus('AVAILABLE');
      setIsActive(true);
    } else {
      if (!vehicle) return;
      setSelectedId(vehicle.id);
      setPlateNumber(vehicle.plateNumber);
      setModel(vehicle.model);
      setOdometer(vehicle.odometer);
      setStatus(vehicle.status);
      setIsActive(vehicle.isActive);
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!plateNumber.trim() || !model.trim()) {
      setError('Plate number and model are required.');
      return;
    }

    try {
      if (modalMode === 'create') {
        await api.post('/vehicles', {
          plateNumber: plateNumber.trim(),
          model: model.trim(),
          odometer: Number(odometer) || 0,
          status,
        });
      } else {
        await api.patch(`/vehicles/${selectedId}`, {
          plateNumber: plateNumber.trim(),
          model: model.trim(),
          odometer: Number(odometer) || 0,
          status,
          isActive,
        });
      }
      setShowModal(false);
      fetchVehicles();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save vehicle.');
    }
  };

  const handleDelete = async (id: string, plate: string) => {
    if (!confirm(`Are you sure you want to delete vehicle ${plate}?`)) return;
    try {
      await api.delete(`/vehicles/${id}`);
      fetchVehicles();
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
    }
  };

  const filtered = vehicles.filter((v) =>
    v.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
    v.model.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fleet Vehicles</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage company trucks and logistics vehicles.</p>
        </div>
        <button
          onClick={() => openModal('create')}
          className="flex items-center gap-2 bg-[#1a1f6e] hover:bg-[#151b4f] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md"
        >
          <Plus className="w-4 h-4" /> Create New Vehicle
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search vehicles by plate or model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/30 transition-all text-sm"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading vehicles...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold">
                  <th className="pb-3 px-4">Plate Number</th>
                  <th className="pb-3 px-4">Model</th>
                  <th className="pb-3 px-4">Odometer</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Active</th>
                  <th className="pb-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">{v.plateNumber}</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-slate-300 font-semibold">{v.model}</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-slate-300 font-semibold">{Number(v.odometer).toLocaleString()} km</td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        v.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        v.status === 'UNDER_REPAIR' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {v.isActive ? (
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-500/20">Active</span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full text-xs font-bold border border-slate-200">Inactive</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openModal('edit', v)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/35 rounded-lg transition-colors"
                          title="Edit vehicle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.plateNumber)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/35 rounded-lg transition-colors"
                          title="Delete vehicle"
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
            <DialogTitle>{modalMode === 'create' ? 'Create New Vehicle' : 'Edit Vehicle'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="plateNumber">Plate Number</Label>
              <Input
                id="plateNumber"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="e.g. ABC-1234"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Isuzu Elf"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="odometer">Odometer (km)</Label>
              <Input
                id="odometer"
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">AVAILABLE</SelectItem>
                  <SelectItem value="IN_TRANSIT">IN TRANSIT</SelectItem>
                  <SelectItem value="UNDER_MAINTENANCE">UNDER MAINTENANCE</SelectItem>
                  <SelectItem value="UNDER_REPAIR">UNDER REPAIR</SelectItem>
                </SelectContent>
              </Select>
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
                <Label htmlFor="isActive" className="cursor-pointer">Active in Fleet</Label>
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
