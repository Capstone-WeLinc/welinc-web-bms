import ModalHeader from '../../components/ui/ModalHeader';
import TotalRow from '../../components/shared/TotalRow';
import SalesReportDetailsDialog from '../../components/shared/SalesReportDetailsDialog';
import PageHeader from '../../components/pageheader/Pageheader';
import TablePagination from '../../components/ui/TablePagination';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Calendar,
  ChevronDown,
  Eye,
  Truck,
  Banknote,
  Landmark,
  Wallet,
  Diamond,
  Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import type { DailySalesEntry } from '../../lib/types';
import {
  Dialog,
  DialogContent,
} from '../../components/ui/Dialog';
import { DatePicker } from '../../components/ui/DatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
type PeriodType = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

interface SalesSummaryStats {
  inHouse: number;
  subcontracted: number;
  cash: number;
  bdo: number;
  gcash: number;
  xendit: number;
  totalSales: number;
}

interface YearlyMonthlyRow {
  monthName: string;
  monthNumber: string;
  inHouse: number;
  subcontract: number;
  cash: number;
  bdo: number;
  gcash: number;
  xendit: number;
  totalSales: number;
  entries: DailySalesEntry[];
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatPeso(n: number): string {
  const value = Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-₱ ${value}` : `₱ ${value}`;
}

function formatAmountField(val: string | number | null | undefined): string {
  const num = toNumber(val);
  return num !== 0 ? formatPeso(num) : '-';
}

const MONTHLY_SUMMARY_CURRENCY = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function formatMonthlySummaryMoney(value: string | number | null | undefined): string {
  return MONTHLY_SUMMARY_CURRENCY.format(toNumber(value));
}


const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const getTodayStr = (): string => new Date().toISOString().split('T')[0];

function getWeekBounds(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const dayFromMonday = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - dayFromMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const toValue = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return { start: toValue(start), end: toValue(end) };
}

interface PeriodSummaryRow extends Omit<YearlyMonthlyRow, 'monthName' | 'monthNumber'> {
  id: string;
  label: string;
  subLabel?: string;
}

function formatFilterDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateValue
    : date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

async function loadSubmittedSalesFromApi(): Promise<DailySalesEntry[]> {
  const res = await api.get<DailySalesEntry[]>('/daily-sales?submittedOnly=true');
  if (!Array.isArray(res.data)) throw new Error('Invalid sales report response');
  return res.data;
}

export default function AdminSalesReport() {
  const [period, setPeriod] = useState<PeriodType>('Daily');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr);
  const [appliedPeriod, setAppliedPeriod] = useState<PeriodType>('Daily');
  const [appliedDate, setAppliedDate] = useState<string>(getTodayStr);

  const [entries, setEntries] = useState<DailySalesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [viewEntry, setViewEntry] = useState<DailySalesEntry | null>(null);
  const [viewMonth, setViewMonth] = useState<YearlyMonthlyRow | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!monthPickerOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      // The year dropdown's option list is portaled to <body>; clicks inside it still belong to this picker.
      if ((event.target as Element | null)?.closest?.('[data-select-content]')) return;
      if (!monthPickerRef.current?.contains(event.target as Node)) setMonthPickerOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      // Radix marks Escape as handled when it only closes the year dropdown.
      if (event.key === 'Escape' && !event.defaultPrevented) setMonthPickerOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [monthPickerOpen]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(false);

    loadSubmittedSalesFromApi()
      .then((data) => {
        if (mounted) {
          setEntries(data);
        }
      })
      .catch(() => {
        if (mounted) {
          setLoadError(true);
          setEntries([]);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  // Auto-apply when clicking Daily, Weekly, Monthly, Yearly
  const handlePeriodChange = (p: PeriodType) => {
    setMonthPickerOpen(false);
    setPeriod(p);
    setAppliedPeriod(p);
    if (p === 'Daily') {
      const todayStr = getTodayStr();
      setSelectedDate(todayStr);
      setAppliedDate(todayStr);
    } else {
      setAppliedDate(selectedDate);
    }
    setCurrentPage(1);
  };

  // Auto-apply when changing date
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setAppliedDate(newDate);
    setCurrentPage(1);
  };

  // Auto-apply when changing year
  const handleYearChange = (yearVal: string) => {
    const validYear = yearVal.slice(0, 4);
    const updated = `${validYear}-01-01`;
    setSelectedDate(updated);
    setAppliedDate(updated);
    setCurrentPage(1);
  };

  const handleApplyFilter = () => {
    setAppliedPeriod(period);
    setAppliedDate(selectedDate);
    setCurrentPage(1);
    toast.success(`Filter applied: ${period} for ${period === 'Yearly' ? selectedDate.slice(0, 4) : selectedDate}`);
  };

  // Filter entries based on the applied period and date
  const filteredEntries = useMemo(() => {
    const todayStr = getTodayStr();

    return entries.filter((entry) => {
      const entryDate = entry.date ? entry.date.slice(0, 10) : '';
      if (!entryDate) return true;

      // In Daily mode: strictly show today's data (or chosen date)
      if (appliedPeriod === 'Daily') {
        const targetDate = appliedDate || todayStr;
        return entryDate === targetDate;
      }
      if (appliedPeriod === 'Weekly') {
        const targetDate = appliedDate || todayStr;
        const { start, end } = getWeekBounds(targetDate);
        return entryDate >= start && entryDate <= end;
      }
      if (appliedPeriod === 'Monthly') {
        const targetDate = appliedDate || todayStr;
        return entryDate.slice(0, 7) === targetDate.slice(0, 7);
      }
      if (appliedPeriod === 'Yearly') {
        const targetDate = appliedDate || todayStr;
        return entryDate.slice(0, 4) === targetDate.slice(0, 4);
      }
      return true;
    });
  }, [entries, appliedPeriod, appliedDate]);

  // Compute 7 summary stat cards based on filtered entries
  const summaryStats: SalesSummaryStats = useMemo(() => {
    let inHouse = 0;
    let subcontracted = 0;
    let cash = 0;
    let bdo = 0;
    let gcash = 0;
    let xendit = 0;
    let totalSales = 0;

    filteredEntries.forEach((e) => {
      if (e.type?.toLowerCase() === 'inhouse') inHouse += 1;
      if (e.type?.toLowerCase() === 'subcon') subcontracted += 1;

      cash += toNumber(e.cashPayment);
      bdo += toNumber(e.bdoPayment);
      gcash += toNumber(e.gcashPayment);
      xendit += toNumber(e.xenditPayment);
      totalSales += toNumber(e.amount || e.totalDailySales);
    });

    return {
      inHouse,
      subcontracted,
      cash,
      bdo,
      gcash,
      xendit,
      totalSales,
    };
  }, [filteredEntries]);

  const periodSummaryRows = useMemo<PeriodSummaryRow[]>(() => {
    if (appliedPeriod !== 'Weekly' && appliedPeriod !== 'Monthly') return [];
    const groups = new Map<string, { label: string; subLabel?: string; entries: DailySalesEntry[] }>();

    filteredEntries.forEach((entry) => {
      if (appliedPeriod === 'Weekly') {
        const group = groups.get(entry.date) ?? { label: entry.date, entries: [] };
        group.entries.push(entry);
        groups.set(entry.date, group);
        return;
      }

      const date = new Date(`${entry.date}T00:00:00`);
      const first = new Date(date.getFullYear(), date.getMonth(), 1);
      const firstDayFromMonday = (first.getDay() + 6) % 7;
      const weekNumber = Math.ceil((date.getDate() + firstDayFromMonday) / 7);
      const weekStart = new Date(date.getFullYear(), date.getMonth(), 1 + (weekNumber - 1) * 7 - firstDayFromMonday);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const id = `week-${weekNumber}`;
      const group = groups.get(id) ?? {
        label: `Week ${weekNumber}`,
        subLabel: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        entries: [],
      };
      group.entries.push(entry);
      groups.set(id, group);
    });

    return Array.from(groups.entries()).map(([id, group]) => {
      const totals = group.entries.reduce(
        (sum, entry) => ({
          inHouse: sum.inHouse + (entry.type?.toLowerCase() === 'inhouse' ? 1 : 0),
          subcontract: sum.subcontract + (entry.type?.toLowerCase() === 'subcon' ? 1 : 0),
          cash: sum.cash + toNumber(entry.cashPayment),
          bdo: sum.bdo + toNumber(entry.bdoPayment),
          gcash: sum.gcash + toNumber(entry.gcashPayment),
          xendit: sum.xendit + toNumber(entry.xenditPayment),
          totalSales: sum.totalSales + toNumber(entry.amount || entry.totalDailySales),
        }),
        { inHouse: 0, subcontract: 0, cash: 0, bdo: 0, gcash: 0, xendit: 0, totalSales: 0 },
      );
      return { id, ...group, ...totals };
    }).sort((a, b) => a.id.localeCompare(b.id));
  }, [appliedPeriod, filteredEntries]);

  // Monthly aggregated rows for Yearly Report
  const yearlyMonthlyRows: YearlyMonthlyRow[] = useMemo(() => {
    if (appliedPeriod !== 'Yearly') return [];
    const yearStr = appliedDate.slice(0, 4);

    return MONTH_NAMES.map((name, index) => {
      const monthNum = String(index + 1).padStart(2, '0');
      const monthKey = `${yearStr}-${monthNum}`;

      const monthEntries = entries.filter((e) => {
        const entryDate = e.date ? e.date.slice(0, 7) : '';
        return entryDate === monthKey;
      });

      let inHouse = 0;
      let subcontract = 0;
      let cash = 0;
      let bdo = 0;
      let gcash = 0;
      let xendit = 0;
      let totalSales = 0;

      monthEntries.forEach((e) => {
        if (e.type?.toLowerCase() === 'inhouse') inHouse += 1;
        if (e.type?.toLowerCase() === 'subcon') subcontract += 1;

        cash += toNumber(e.cashPayment);
        bdo += toNumber(e.bdoPayment);
        gcash += toNumber(e.gcashPayment);
        xendit += toNumber(e.xenditPayment);
        totalSales += toNumber(e.amount || e.totalDailySales);
      });

      return {
        monthName: name,
        monthNumber: monthNum,
        inHouse,
        subcontract,
        cash,
        bdo,
        gcash,
        xendit,
        totalSales,
        entries: monthEntries,
      };
    });
  }, [entries, appliedPeriod, appliedDate]);

  // Formatted Period Title for Summary Header
  const summaryTitle = useMemo(() => {
    const d = new Date(appliedDate + 'T00:00:00');
    const formattedDate = !isNaN(d.getTime())
      ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : appliedDate;

    if (appliedPeriod === 'Daily') return `Daily Sales Summary - ${formattedDate}`;
    if (appliedPeriod === 'Weekly') {
      const { start, end } = getWeekBounds(appliedDate);
      return `Weekly Sales Summary - ${new Date(`${start}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${new Date(`${end}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    if (appliedPeriod === 'Monthly') {
      const monthYear = !isNaN(d.getTime())
        ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : appliedDate;
      return `Monthly Sales Summary - ${monthYear}`;
    }
    return `Yearly Sales Summary - ${appliedDate.slice(0, 4)}`;
  }, [appliedPeriod, appliedDate]);

  // Pagination calculations
  const isYearly = appliedPeriod === 'Yearly';
  const isPeriodSummary = appliedPeriod === 'Weekly' || appliedPeriod === 'Monthly';
  const tableDataCount = isYearly ? yearlyMonthlyRows.length : isPeriodSummary ? periodSummaryRows.length : filteredEntries.length;
  const totalPages = Math.max(1, Math.ceil(tableDataCount / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEntries = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredEntries.slice(start, start + rowsPerPage);
  }, [filteredEntries, safePage, rowsPerPage]);
  const paginatedYearlyRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return yearlyMonthlyRows.slice(start, start + rowsPerPage);
  }, [yearlyMonthlyRows, safePage, rowsPerPage]);
  const paginatedPeriodRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return periodSummaryRows.slice(start, start + rowsPerPage);
  }, [periodSummaryRows, safePage, rowsPerPage]);


  if (loadError && !loading) {
    return (
      <div className="space-y-4">
        <PageHeader icon={Banknote} title="SALES REPORT" />
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
          <p className="font-semibold">Current sales reports are unavailable.</p>
          <p className="mt-1 text-sm">The BMS API could not load submitted sales. No report totals are shown.</p>
          <button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold hover:bg-red-100">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Banknote}
        title="SALES REPORT"
        subtitle={<>Aggregate view of submitted sales <span className="font-medium text-[#d4a72c]">reports across periods.</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
      />

      {/* Period Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Toggle Buttons: Daily, Weekly, Monthly, Yearly */}
        <div className="inline-flex bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl gap-1 border border-slate-200 dark:border-slate-700">
          {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as PeriodType[]).map((p) => {
            const isActive = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[#1a1f6e] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Date / Period Selector & Apply Button */}
        <div className="flex items-center gap-3">
          {period === 'Yearly' ? (
            <div className="relative flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 shadow-sm min-w-[150px]">
              <Calendar className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
              <input
                type="number"
                min="2000"
                max="2099"
                value={selectedDate.slice(0, 4)}
                onChange={(e) => handleYearChange(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none w-20 cursor-pointer"
              />
            </div>
          ) : period === 'Monthly' ? (
            <div ref={monthPickerRef} className="relative min-w-[230px]">
              <button
                type="button"
                onClick={() => setMonthPickerOpen((open) => !open)}
                aria-haspopup="dialog"
                aria-expanded={monthPickerOpen}
                className="flex w-full items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                <Calendar className="mr-2 h-4 w-4 flex-shrink-0 text-slate-500" />
                <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {new Date(`${selectedDate.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${monthPickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {monthPickerOpen && (
                <div
                  role="dialog"
                  aria-label="Choose report month"
                  className="absolute left-0 top-full z-50 mt-2 w-[310px] rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_16px_40px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="relative mb-2">
                    <Select
                      value={selectedDate.slice(0, 4)}
                      onValueChange={(year) => {
                        const month = selectedDate.slice(5, 7);
                        handleDateChange(`${year}-${month}-01`);
                      }}
                    >
                      <SelectTrigger
                        aria-label="Select year"
                        className="h-11 rounded-lg border-0 bg-slate-100 px-3 py-1.5 text-base font-semibold text-[#0a0f2e] shadow-none transition focus:ring-2 focus:ring-[#0a0f2e]/15 dark:bg-slate-700 dark:text-white [&>svg]:text-[#0a0f2e] [&>svg]:opacity-100 dark:[&>svg]:text-white"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 100 }, (_, index) => String(2000 + index)).map((year) => (
                          <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-4 gap-x-1 gap-y-0.5" role="grid">
                    {MONTH_NAMES.map((month, index) => {
                      const monthNumber = String(index + 1).padStart(2, '0');
                      const selected = selectedDate.slice(5, 7) === monthNumber;
                      return (
                        <button
                          key={month}
                          type="button"
                          onClick={() => {
                            handleDateChange(`${selectedDate.slice(0, 4)}-${monthNumber}-01`);
                            setMonthPickerOpen(false);
                          }}
                          className={`h-10 rounded-lg px-1 text-center text-base leading-5 transition-colors ${selected ? 'bg-[#1a1f6e] font-medium text-white shadow-sm' : 'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700'}`}
                        >
                          {month.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="min-w-[230px]">
              <DatePicker
                value={selectedDate}
                onChange={handleDateChange}
                placeholder={period === 'Weekly' ? 'Select week date' : 'Select report date'}
              />
              {period === 'Weekly' && (
                <p className="mt-1 px-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {(() => {
                    const { start, end } = getWeekBounds(selectedDate);
                    return `Week: ${formatFilterDate(start)} - ${formatFilterDate(end)}`;
                  })()}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleApplyFilter}
            className="rounded-xl bg-[#1a1f6e] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#141a6b]"
          >
            Apply Filter
          </button>
        </div>
      </div>

      {/* Summary Section Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
        {/* Title */}
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
          <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <span>{summaryTitle}</span>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: 'Total In-house', value: String(summaryStats.inHouse), icon: Truck, color: '#1a1f6e' },
            { label: 'Total Subcontracted', value: String(summaryStats.subcontracted), icon: Truck, color: '#6366f1' },
            { label: 'Total Cash', value: formatPeso(summaryStats.cash), icon: Banknote, color: '#10b981' },
            { label: 'Total BDO', value: formatPeso(summaryStats.bdo), icon: Landmark, color: '#0ea5e9' },
            { label: 'Total GCash', value: formatPeso(summaryStats.gcash), icon: Wallet, color: '#3b82f6' },
            { label: 'Total Xendit', value: formatPeso(summaryStats.xendit), icon: Diamond, color: '#8b5cf6' },
            { label: 'Total Sales', value: formatPeso(summaryStats.totalSales), icon: Calculator, color: '#0a0f2e' },
          ].map(({ label, value, icon: Icon, color }) => (
            <article key={label} className="flex min-h-[88px] min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}18` }}>
                <Icon className="h-5 w-5" style={{ color }} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-4 text-slate-700 dark:text-slate-200">{label}</p>
                <p className="mt-1 break-words text-lg font-bold leading-tight tabular-nums text-[#0b0f4a] dark:text-white">{value}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Table Section Card */}
      <div className="rounded-none border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          {isYearly ? (
            /* YEARLY REPORT TABLE VIEW */
            <table className="min-w-[1100px] w-full table-auto text-sm">
              <thead className="bg-[#1a1f6e]">
                <tr>
                  {[
                    'DATE',
                    'INHOUSE',
                    'SUBCONTRACT',
                    'CASH',
                    'BDO',
                    'GCASH',
                    'XENDIT',
                    'TOTAL SALES',
                    'ACTION',
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      Loading yearly sales reports...
                    </td>
                  </tr>
                ) : (
                  paginatedYearlyRows.map((row) => (
                    <tr
                      key={row.monthNumber}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      {/* DATE / MONTH */}
                      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap text-sm">
                        {row.monthName}
                      </td>

                      {/* INHOUSE */}
                      <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm font-medium">
                        {row.inHouse}
                      </td>

                      {/* SUBCONTRACT */}
                      <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm font-medium">
                        {row.subcontract}
                      </td>

                      {/* CASH */}
                      <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                        {row.cash !== 0 ? formatPeso(row.cash) : '-'}
                      </td>

                      {/* BDO */}
                      <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                        {row.bdo !== 0 ? formatPeso(row.bdo) : '-'}
                      </td>

                      {/* GCASH */}
                      <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                        {row.gcash !== 0 ? formatPeso(row.gcash) : '-'}
                      </td>

                      {/* XENDIT */}
                      <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                        {row.xendit !== 0 ? formatPeso(row.xendit) : '-'}
                      </td>

                      {/* TOTAL SALES */}
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap text-sm">
                        {row.totalSales !== 0 ? formatPeso(row.totalSales) : '-'}
                      </td>

                      {/* ACTION */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewMonth(row)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title={`View ${row.monthName} Details`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : isPeriodSummary ? (
            /* WEEKLY / MONTHLY AGGREGATED TABLE VIEW */
            <table className="min-w-[1100px] w-full table-auto text-sm">
              <thead className="bg-[#1a1f6e]">
                <tr>
                  {['DATE', 'INHOUSE', 'SUBCONTRACT', 'CASH', 'BDO', 'GCASH', 'XENDIT', 'TOTAL SALES', 'ACTION'].map((col) => (
                    <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Loading sales reports...</td></tr>
                ) : paginatedPeriodRows.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">No sales reports found for the selected period.</td></tr>
                ) : (
                  <>
                    {paginatedPeriodRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white">
                          <p>{row.label}</p>
                          {row.subLabel && <p className="mt-0.5 text-sm font-normal text-slate-500">{row.subLabel}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-300">{row.inHouse}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-300">{row.subcontract}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-300">{row.cash ? formatPeso(row.cash) : '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-300">{row.bdo ? formatPeso(row.bdo) : '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-300">{row.gcash ? formatPeso(row.gcash) : '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-300">{row.xendit ? formatPeso(row.xendit) : '-'}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white">{row.totalSales ? formatPeso(row.totalSales) : '-'}</td>
                        <td className="px-4 py-2.5">
                          <button type="button" disabled={!row.entries[0]} onClick={() => setViewEntry(row.entries[0] ?? null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:hover:bg-slate-700 dark:hover:text-white" title="View Sales Details">
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 bg-slate-200/80 font-bold text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                      <td className="px-4 py-2.5 text-sm">{appliedPeriod} Total</td>
                      <td className="px-4 py-2.5 text-sm">{summaryStats.inHouse}</td>
                      <td className="px-4 py-2.5 text-sm">{summaryStats.subcontracted}</td>
                      <td className="px-4 py-2.5 text-sm">{formatAmountField(summaryStats.cash)}</td>
                      <td className="px-4 py-2.5 text-sm">{formatAmountField(summaryStats.bdo)}</td>
                      <td className="px-4 py-2.5 text-sm">{formatAmountField(summaryStats.gcash)}</td>
                      <td className="px-4 py-2.5 text-sm">{formatAmountField(summaryStats.xendit)}</td>
                      <td className="px-4 py-2.5 text-sm">{formatAmountField(summaryStats.totalSales)}</td>
                      <td />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          ) : (
            /* DAILY TABLE VIEW */
            <table className="min-w-[1100px] w-full table-auto text-sm">
              <thead className="bg-[#1a1f6e]">
                <tr>
                  {[
                    'DATE',
                    'CLIENT',
                    'AMOUNT',
                    'CASH',
                    'BDO',
                    'GCASH',
                    'XENDIT',
                    'DATE OF PAYMENT',
                    'INVOICE NO.',
                    'ACTION',
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      Loading sales reports...
                    </td>
                  </tr>
                ) : paginatedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      No sales reports found for the selected period.
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry) => {
                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        {/* DATE */}
                        <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                          {entry.date}
                        </td>

                        {/* CLIENT */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <p className="font-bold text-slate-900 dark:text-white text-sm">
                            {entry.clientName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {entry.bookingNo || entry.traceNo || '-'}
                          </p>
                        </td>

                        {/* AMOUNT */}
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap text-sm">
                          {formatAmountField(entry.amount || entry.totalDailySales)}
                        </td>

                        {/* CASH */}
                        <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                          {formatAmountField(entry.cashPayment)}
                        </td>

                        {/* BDO */}
                        <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                          {formatAmountField(entry.bdoPayment)}
                        </td>

                        {/* GCASH */}
                        <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                          {formatAmountField(entry.gcashPayment)}
                        </td>

                        {/* XENDIT */}
                        <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                          {formatAmountField(entry.xenditPayment)}
                        </td>

                        {/* DATE OF PAYMENT */}
                        <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                          {entry.dateOfPayment || entry.date}
                        </td>

                        {/* INVOICE NO. */}
                        <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap text-sm">
                          {entry.traceNo}
                        </td>

                        {/* ACTION */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewEntry(entry)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="View Sales Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <TablePagination page={safePage} totalPages={totalPages} totalItems={tableDataCount} pageSize={rowsPerPage} onPageChange={setCurrentPage} onPageSizeChange={size => { setRowsPerPage(size); setCurrentPage(1); }} />
      </div>

      {/* View Month Details Modal Dialog */}
      <Dialog open={!!viewMonth} onOpenChange={() => setViewMonth(null)}>
        <DialogContent hideCloseButton className="gap-0 max-w-2xl overflow-hidden border-0 bg-transparent p-0 shadow-xl sm:rounded-2xl">
          {viewMonth && (
            <div className="overflow-hidden rounded-2xl bg-white">
              <ModalHeader
                icon={FileText}
                title={`${viewMonth.monthName} ${appliedDate.slice(0, 4)} sales summary`}
                subtitle="MONTHLY SALES"
                closeLabel="Close monthly sales summary"
              />

              <div className="max-h-[70vh] space-y-2.5 overflow-y-auto bg-[#f1f4fa] p-4">
                <section className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Monthly sales totals">
                  <div className="rounded-xl border border-slate-200/70 bg-white p-3.5">
                    <p className="text-sm text-slate-600">In-house trips</p>
                    <p className={`mt-1 text-xl font-semibold tabular-nums ${viewMonth.inHouse === 0 ? 'text-slate-400' : 'text-slate-900'}`}>{viewMonth.inHouse}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white p-3.5">
                    <p className="text-sm text-slate-600">Subcontracted</p>
                    <p className={`mt-1 text-xl font-semibold tabular-nums ${viewMonth.subcontract === 0 ? 'text-slate-400' : 'text-slate-900'}`}>{viewMonth.subcontract}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white p-3.5">
                    <p className="text-sm text-slate-600">Cash collected</p>
                    <p className={`mt-1 text-xl font-semibold tabular-nums ${toNumber(viewMonth.cash) === 0 ? 'text-slate-400' : 'text-slate-900'}`}>{formatMonthlySummaryMoney(viewMonth.cash)}</p>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">
                      <span className="h-3.5 w-[3px] rounded-full bg-[#e8b800]" aria-hidden="true" />
                      Recorded invoices in {viewMonth.monthName}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{viewMonth.entries.length}</span>
                  </div>
                  {viewMonth.entries.length === 0 ? (
                    <p className="py-5 text-center text-sm text-slate-500">No invoices recorded this month.</p>
                  ) : (
                    <div className="max-h-60 space-y-2 overflow-y-auto">
                      {viewMonth.entries.map((item) => {
                        return (
                          <div key={item.id} className="flex items-end justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{item.clientName || '—'}</p>
                              <p className="truncate text-sm text-slate-600">{item.bookingNo || item.traceNo || '—'}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end">
                              <p className="text-sm text-slate-600">{item.date}</p>
                              <p className="text-sm font-medium tabular-nums text-slate-900">{formatMonthlySummaryMoney(item.amount || item.totalDailySales)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-3">
                    <TotalRow
                      value={formatMonthlySummaryMoney(viewMonth.totalSales)}
                      note={`${viewMonth.entries.length} ${viewMonth.entries.length === 1 ? 'invoice' : 'invoices'} recorded`}
                    />
                  </div>
                </section>

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Individual Entry Details Modal Dialog */}
      <SalesReportDetailsDialog entry={viewEntry} onClose={() => setViewEntry(null)} />
    </div>
  );
}
