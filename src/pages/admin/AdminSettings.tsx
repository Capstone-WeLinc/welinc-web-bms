import { Sun, Moon, Globe } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
export default function AdminSettings() {
  const { user, darkMode, toggleDarkMode } = useApp();
  

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {/* Appearance */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            {darkMode ? <Moon className="w-4 h-4 text-slate-500" /> : <Sun className="w-4 h-4 text-yellow-500" />}
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Appearance</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Dark Mode</p>
              <p className="text-xs text-slate-400 mt-0.5">Switch between light and dark themes</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${darkMode ? 'bg-[#1a1f6e]' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
      </div>

     

      {/* Account Info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Account Information</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Full Name', value: user?.fullName },
            { label: 'Username', value: user?.username },
            { label: 'Role', value: user?.role },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{f.label}</label>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
