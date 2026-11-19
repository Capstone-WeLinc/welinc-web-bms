import ExcelJS from 'exceljs';

export type PostServiceExcelRow = {
  bookingNo: string;
  client: string;
  service: string;
  serviceDate: Date | string;
  payment: string;
  amountPaid: number | null;
  status: string;
};

const borderColor = 'FFE2E8F0';

export function toPostServiceExcelDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (datePart) {
    const [, year, month, day] = datePart;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
      ? date
      : null;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? null
    : new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export async function exportPostServiceExcel(rows: PostServiceExcelRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Post-Service');

  sheet.columns = [
    { header: 'Booking no.', key: 'bookingNo', width: 22 },
    { header: 'Client', key: 'client', width: 28 },
    { header: 'Service', key: 'service', width: 26 },
    { header: 'Service date', key: 'serviceDate', width: 15 },
    { header: 'Payment', key: 'payment', width: 14 },
    { header: 'Amount paid', key: 'amountPaid', width: 18 },
    { header: 'Status', key: 'status', width: 20 },
  ];

  for (const row of rows) sheet.addRow(row);

  const header = sheet.getRow(1);
  header.height = 26;
  header.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B0F4A' } };
    cell.alignment = {
      horizontal: columnNumber === 6 ? 'right' : 'left',
      vertical: 'middle',
      indent: 1,
    };
  });

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = {
        horizontal: columnNumber === 6 ? 'right' : 'left',
        vertical: 'middle',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: borderColor } },
        left: { style: 'thin', color: { argb: borderColor } },
        bottom: { style: 'thin', color: { argb: borderColor } },
        right: { style: 'thin', color: { argb: borderColor } },
      };
    });

    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    const dateCell = row.getCell(4);
    if (dateCell.value instanceof Date) dateCell.numFmt = 'yyyy-mm-dd';
    const amountCell = row.getCell(6);
    amountCell.numFmt = '"₱"#,##0.00';
    amountCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const paymentCell = row.getCell(5);
    if (String(paymentCell.value || '').trim().toLowerCase() === 'paid') {
      paymentCell.font = { name: 'Arial', size: 10, color: { argb: 'FF047857' } };
      paymentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    }

    const statusCell = row.getCell(7);
    if (String(statusCell.value || '').toLowerCase().includes('pending')) {
      statusCell.font = { name: 'Arial', size: 10, color: { argb: 'FF92400E' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
    } else {
      statusCell.font = { name: 'Arial', size: 10, color: { argb: 'FF047857' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    }
  });

  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  sheet.autoFilter = { from: 'A1', to: `G${Math.max(1, rows.length + 1)}` };
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:1',
  };
  sheet.headerFooter.oddHeader = '&CWeLinc Logistics - Post-service report';
  sheet.headerFooter.oddFooter = '&CPage &P of &N';

  const buffer = await workbook.xlsx.writeBuffer();
  const fileData = new Uint8Array(buffer.byteLength);
  fileData.set(buffer as unknown as ArrayLike<number>);
  const blob = new Blob([fileData.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'post-service-report.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}
