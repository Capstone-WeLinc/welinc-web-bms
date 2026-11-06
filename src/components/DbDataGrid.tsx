interface DbDataGridProps {
  columns: string[];
  rows: any[];
  maxHeight?: string;
}

export default function DbDataGrid({ columns, rows, maxHeight = '500px' }: DbDataGridProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 py-4">No rows returned.</p>;
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="overflow-auto border border-slate-200 rounded-lg" style={{ maxHeight }}>
      <table className="min-w-full text-sm text-left">
        <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 border-b border-slate-200 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-slate-50">
              {columns.map((col) => {
                const value = Array.isArray(row) ? row[columns.indexOf(col)] : row[col];
                const formatted = formatValue(value);
                return (
                  <td
                    key={col}
                    className={`px-3 py-2 whitespace-nowrap max-w-xs truncate ${
                      value === null || value === undefined ? 'text-slate-400 italic' : 'text-slate-800'
                    }`}
                    title={formatted.length > 30 ? formatted : undefined}
                  >
                    {formatted.length > 40 ? `${formatted.slice(0, 40)}...` : formatted}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
