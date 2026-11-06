import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadJobOrderLogo } from './jobOrderDocument';

/**
 * Branded Excel and PDF exports for the Reports page. Each tab describes what it
 * shows as a ReportDocument; both formats are drawn from that one description so
 * the files always match the screen and each other.
 */

export type ReportValueFormat = 'text' | 'number' | 'peso' | 'percent' | 'decimal';
export type ReportCell = string | number | null;

export type ReportMetricsSection = {
  kind: 'metrics';
  title: string;
  items: { label: string; value: ReportCell; format?: ReportValueFormat; note?: string }[];
};
export type ReportTableSection = {
  kind: 'table';
  title: string;
  note?: string;
  columns: { header: string; key: string; format?: ReportValueFormat; width?: number }[];
  rows: Record<string, ReportCell>[];
  totals?: Record<string, ReportCell>;
  emptyText?: string;
};
export type ReportListSection = { kind: 'list'; title: string; items: string[]; emptyText?: string };
export type ReportSection = ReportMetricsSection | ReportTableSection | ReportListSection;

export type ReportDocument = {
  /** e.g. "Operational Report" */
  reportName: string;
  /** Used in file names, e.g. "operational-report" */
  fileStem: string;
  period: string;
  filters: { label: string; value: string }[];
  generatedBy: string;
  generatedAt: Date;
  /** Use a landscape PDF page for reports with many columns. */
  landscape?: boolean;
  sections: ReportSection[];
};

const COMPANY = 'WeLinc Logistics';
const NAVY = '0B0F4A';
const NAVY_SOFT = '1A1F6E';
const GOLD = 'E8B800';
const ZEBRA = 'F8FAFC';
const PANEL = 'F1F4FA';
const BORDER = 'E2E8F0';
const INK = '0F172A';
const MUTED = '64748B';

const NBSP = String.fromCharCode(0x00a0);
const pesoText = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' });
const numberText = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 });

function fileDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function generatedText(date: Date) {
  return date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Human-readable value, used by the PDF and for Excel cells that cannot stay numeric. */
export function formatReportValue(value: ReportCell, format: ReportValueFormat = 'text') {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value === 'string') return value;
  if (format === 'peso') return pesoText.format(value).split(NBSP).join(' ');
  if (format === 'percent') return `${numberText.format(value)}%`;
  if (format === 'decimal') return numberText.format(value);
  return new Intl.NumberFormat('en-PH').format(value);
}

/** The standard PDF fonts only cover Latin-1, so swap the few typographic characters the reports use. */
const PDF_REPLACEMENTS: [number, string][] = [
  [0x2014, '-'], [0x2013, '-'], [0x2018, "'"], [0x2019, "'"], [0x201c, '"'], [0x201d, '"'],
  [0x2026, '...'], [0x25b2, '+'], [0x25bc, '-'], [0x20b1, 'PHP '], [0x00a0, ' '],
];
function pdfSafe(text: string) {
  return PDF_REPLACEMENTS.reduce((result, [code, replacement]) => result.split(String.fromCharCode(code)).join(replacement), text);
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ Excel */

const thin = { style: 'thin' as const, color: { argb: `FF${BORDER}` } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };

function excelNumFmt(format?: ReportValueFormat) {
  if (format === 'peso') return '"₱"#,##0.00';
  if (format === 'percent') return '0.0%';
  if (format === 'decimal') return '#,##0.0';
  if (format === 'number') return '#,##0';
  return undefined;
}

function excelValue(value: ReportCell, format?: ReportValueFormat): ExcelJS.CellValue {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value === 'number' && format === 'percent') return value / 100;
  return value;
}

function isNumeric(format?: ReportValueFormat) {
  return format === 'number' || format === 'peso' || format === 'percent' || format === 'decimal';
}

/** Navy title band, gold report name, and a thin gold rule, spanning `width` columns. */
function excelBanner(sheet: ExcelJS.Worksheet, report: ReportDocument, subtitle: string, width: number) {
  const span = (row: number) => sheet.mergeCells(row, 1, row, Math.max(width, 2));
  span(1); span(2); span(3);
  const title = sheet.getCell(1, 1);
  title.value = COMPANY;
  title.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { vertical: 'middle', indent: 1 };
  const name = sheet.getCell(2, 1);
  name.value = subtitle;
  name.font = { name: 'Arial', size: 11, bold: true, color: { argb: `FF${GOLD}` } };
  name.alignment = { vertical: 'middle', indent: 1 };
  for (const row of [1, 2]) {
    for (let col = 1; col <= Math.max(width, 2); col += 1) sheet.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
  }
  for (let col = 1; col <= Math.max(width, 2); col += 1) sheet.getCell(3, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GOLD}` } };
  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 20;
  sheet.getRow(3).height = 4;
  void report;
}

function styleHeaderRow(row: ExcelJS.Row, formats: (ReportValueFormat | undefined)[]) {
  row.height = 24;
  formats.forEach((format, index) => {
    const cell = row.getCell(index + 1);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY_SOFT}` } };
    cell.alignment = { vertical: 'middle', horizontal: isNumeric(format) ? 'right' : 'left', indent: 1 };
    cell.border = allBorders;
  });
}

function styleBodyRow(row: ExcelJS.Row, formats: (ReportValueFormat | undefined)[], zebra: boolean, bold = false) {
  row.height = 20;
  formats.forEach((format, index) => {
    const cell = row.getCell(index + 1);
    cell.font = { name: 'Arial', size: 10, bold: bold || index === 0, color: { argb: `FF${INK}` } };
    cell.alignment = { vertical: 'middle', horizontal: isNumeric(format) && typeof cell.value === 'number' ? 'right' : 'left', indent: 1, wrapText: !isNumeric(format) };
    cell.border = allBorders;
    if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ZEBRA}` } };
    const numFmt = excelNumFmt(format);
    if (numFmt && typeof cell.value === 'number') cell.numFmt = numFmt;
    if (cell.value === 'N/A') cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: `FF${MUTED}` } };
  });
}

function sectionTitle(sheet: ExcelJS.Worksheet, rowNumber: number, title: string, width: number) {
  sheet.mergeCells(rowNumber, 1, rowNumber, width);
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = title.toUpperCase();
  cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: `FF${NAVY_SOFT}` } };
  cell.alignment = { vertical: 'middle', indent: 1 };
  cell.border = { left: { style: 'thick', color: { argb: `FF${GOLD}` } } };
  sheet.getRow(rowNumber).height = 22;
}

function sheetName(title: string, used: Set<string>) {
  const base = title.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Sheet';
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i += 1) name = `${base.slice(0, 25)} ${i}`;
  used.add(name.toLowerCase());
  return name;
}

function printSetup(sheet: ExcelJS.Worksheet, report: ReportDocument, repeatRows?: string) {
  sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, ...(repeatRows ? { printTitlesRow: repeatRows } : {}) };
  sheet.headerFooter.oddHeader = `&L${COMPANY}&R${report.reportName}`;
  sheet.headerFooter.oddFooter = `&LGenerated ${generatedText(report.generatedAt)}&RPage &P of &N`;
}

export async function exportReportExcel(report: ReportDocument) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.generatedBy;
  workbook.company = COMPANY;
  workbook.created = report.generatedAt;
  workbook.title = report.reportName;
  const usedNames = new Set<string>();

  /* Summary sheet: report details, then every metrics and list section. */
  const summary = workbook.addWorksheet(sheetName('Summary', usedNames), { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 34 }, { width: 22 }, { width: 46 }];
  excelBanner(summary, report, report.reportName, 3);

  let r = 5;
  const details: [string, string][] = [
    ['Report', report.reportName],
    ['Period', report.period],
    ...report.filters.map((filter) => [filter.label, filter.value] as [string, string]),
    ['Generated by', report.generatedBy],
    ['Generated on', generatedText(report.generatedAt)],
  ];
  for (const [label, value] of details) {
    summary.getCell(r, 1).value = label;
    summary.getCell(r, 1).font = { name: 'Arial', size: 10, bold: true, color: { argb: `FF${MUTED}` } };
    summary.mergeCells(r, 2, r, 3);
    summary.getCell(r, 2).value = value;
    summary.getCell(r, 2).font = { name: 'Arial', size: 10, color: { argb: `FF${INK}` } };
    for (let col = 1; col <= 3; col += 1) summary.getCell(r, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PANEL}` } };
    summary.getRow(r).height = 18;
    r += 1;
  }
  r += 1;

  for (const section of report.sections) {
    if (section.kind === 'metrics') {
      sectionTitle(summary, r, section.title, 3); r += 1;
      const header = summary.getRow(r);
      header.values = ['Measure', 'Value', 'Notes'];
      styleHeaderRow(header, [undefined, 'number', undefined]); r += 1;
      section.items.forEach((item, index) => {
        const row = summary.getRow(r);
        row.values = [item.label, excelValue(item.value, item.format), item.note ?? ''];
        styleBodyRow(row, [undefined, item.format ?? 'text', undefined], index % 2 === 1);
        row.getCell(2).font = { name: 'Arial', size: 10, bold: true, color: { argb: `FF${NAVY}` } };
        row.getCell(3).font = { name: 'Arial', size: 9, color: { argb: `FF${MUTED}` } };
        r += 1;
      });
      r += 1;
    } else if (section.kind === 'list') {
      sectionTitle(summary, r, section.title, 3); r += 1;
      const items = section.items.length ? section.items : [section.emptyText ?? 'Nothing to show.'];
      items.forEach((item, index) => {
        summary.mergeCells(r, 1, r, 3);
        const cell = summary.getCell(r, 1);
        cell.value = section.items.length ? `${index + 1}.  ${item}` : item;
        cell.font = { name: 'Arial', size: 10, color: { argb: `FF${INK}` }, italic: !section.items.length };
        cell.alignment = { wrapText: true, vertical: 'top', indent: 1 };
        summary.getRow(r).height = Math.max(20, Math.ceil(item.length / 95) * 15);
        r += 1;
      });
      r += 1;
    }
  }
  const tableSections = report.sections.filter((section): section is ReportTableSection => section.kind === 'table');
  if (tableSections.length) {
    sectionTitle(summary, r, 'Detailed tables', 3); r += 1;
    tableSections.forEach((section) => {
      summary.mergeCells(r, 1, r, 3);
      summary.getCell(r, 1).value = `• ${section.title} — see the "${section.title.slice(0, 28)}" sheet`;
      summary.getCell(r, 1).font = { name: 'Arial', size: 10, color: { argb: `FF${MUTED}` } };
      summary.getCell(r, 1).alignment = { indent: 1 };
      r += 1;
    });
  }
  printSetup(summary, report);

  /* One sheet per table, with a frozen header row and filters. */
  for (const section of tableSections) {
    const sheet = workbook.addWorksheet(sheetName(section.title, usedNames), { views: [{ showGridLines: false }] });
    const width = section.columns.length;
    sheet.columns = section.columns.map((column) => ({ width: column.width ?? (isNumeric(column.format) ? 16 : 26) }));
    excelBanner(sheet, report, `${report.reportName} — ${section.title}`, width);

    sheet.mergeCells(4, 1, 4, Math.max(width, 2));
    const meta = sheet.getCell(4, 1);
    meta.value = [report.period, ...report.filters.map((filter) => `${filter.label}: ${filter.value}`), section.note].filter(Boolean).join('   ·   ');
    meta.font = { name: 'Arial', size: 9, italic: true, color: { argb: `FF${MUTED}` } };
    meta.alignment = { vertical: 'middle', indent: 1, wrapText: true };
    sheet.getRow(4).height = 20;

    const headerRowNumber = 6;
    const formats = section.columns.map((column) => column.format);
    const header = sheet.getRow(headerRowNumber);
    header.values = section.columns.map((column) => column.header);
    styleHeaderRow(header, formats);

    let rowNumber = headerRowNumber + 1;
    if (!section.rows.length) {
      sheet.mergeCells(rowNumber, 1, rowNumber, Math.max(width, 2));
      const cell = sheet.getCell(rowNumber, 1);
      cell.value = section.emptyText ?? 'No records for this period.';
      cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: `FF${MUTED}` } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(rowNumber).height = 24;
      rowNumber += 1;
    }
    section.rows.forEach((data, index) => {
      const row = sheet.getRow(rowNumber);
      row.values = section.columns.map((column) => excelValue(data[column.key] ?? null, column.format));
      styleBodyRow(row, formats, index % 2 === 1);
      rowNumber += 1;
    });
    if (section.totals && section.rows.length) {
      const row = sheet.getRow(rowNumber);
      row.values = section.columns.map((column, index) => {
        const value = section.totals?.[column.key];
        return value === undefined || value === '' ? (index === 0 ? 'Total' : '') : excelValue(value, column.format);
      });
      styleBodyRow(row, formats, false, true);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PANEL}` } };
        cell.border = { ...allBorders, top: { style: 'medium', color: { argb: `FF${NAVY_SOFT}` } } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: `FF${NAVY}` } };
      });
    }

    sheet.views = [{ state: 'frozen', ySplit: headerRowNumber, showGridLines: false }];
    if (section.rows.length) sheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber + section.rows.length, column: width } };
    printSetup(sheet, report, `${headerRowNumber}:${headerRowNumber}`);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileData = new Uint8Array(buffer.byteLength);
  fileData.set(buffer as unknown as ArrayLike<number>);
  download(new Blob([fileData.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `welinc-${report.fileStem}-${fileDate(report.generatedAt)}.xlsx`);
}

/* -------------------------------------------------------------------- PDF */
/* Follows the Job Order PDF: white letterhead with the logo tile and a navy +
   gold rule, bordered sections with a light title strip, label-over-value
   cells, a bold navy total, and the same small footer. */

type Rgb = [number, number, number];
type FormCell = { label: string; value: string; note?: string; size?: number; bold?: boolean };

const PDF_NAVY: Rgb = [26, 31, 110];
const PDF_GOLD: Rgb = [232, 184, 0];
const PDF_INK: Rgb = [15, 23, 42];
const PDF_LABEL: Rgb = [100, 116, 139];
const PDF_MUTED: Rgb = [148, 163, 184];
const PDF_BORDER: Rgb = [203, 213, 225];
const PDF_HEADING_FILL: Rgb = [241, 244, 250];
const PDF_WHITE: Rgb = [255, 255, 255];

const PDF_MARGIN = 15;
/** Space kept clear at the bottom of each page for the footer. */
const PDF_FOOTER_SPACE = 17;
const HEADING_HEIGHT = 6.5;
const CELL_PADDING_X = 3;
const CELL_PADDING_TOP = 2.2;
const CELL_PADDING_BOTTOM = 2.4;
const CELL_LABEL_HEIGHT = 4;
const SECTION_GAP = 4.5;
const MM_PER_POINT = 0.3528;
const METRICS_PER_ROW = 3;

export async function exportReportPdf(report: ReportDocument) {
  const logo = await loadJobOrderLogo().catch(() => null);
  const doc = new jsPDF(report.landscape ? 'l' : 'p', 'mm', 'a4');
  const pageHeight = doc.internal.pageSize.getHeight();
  const PDF_BOTTOM = pageHeight - PDF_FOOTER_SPACE;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  const rightEdge = pageWidth - PDF_MARGIN;
  let y = 0;

  const applyFont = (size: number, bold: boolean) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
  };
  const lineHeight = (size: number) => size * MM_PER_POINT * 1.25;
  const wrap = (value: string, width: number, size: number, bold: boolean): string[] => {
    applyFont(size, bold);
    return doc.splitTextToSize(pdfSafe(value) || '-', width);
  };
  const write = (value: string | string[], x: number, top: number, size: number, bold: boolean, color: Rgb, align: 'left' | 'right' = 'left') => {
    applyFont(size, bold);
    doc.setTextColor(...color);
    doc.setLineHeightFactor(1.25);
    doc.text(typeof value === 'string' ? pdfSafe(value) : value, x, top + size * MM_PER_POINT, { align });
  };
  const ensureSpace = (height: number) => {
    if (y + height <= PDF_BOTTOM) return;
    doc.addPage();
    y = PDF_MARGIN;
  };
  const strokeBorder = () => {
    doc.setDrawColor(...PDF_BORDER);
    doc.setLineWidth(0.25);
  };
  const isEmpty = (value: string) => !value || value === '-' || value === 'N/A';

  const cellLayout = (cell: FormCell, width: number) => {
    const size = cell.size ?? 10;
    const bold = !!cell.bold && !isEmpty(cell.value);
    const innerWidth = width - CELL_PADDING_X * 2;
    const valueLines = wrap(cell.value, innerWidth, size, bold);
    const noteLines = cell.note ? wrap(cell.note, innerWidth, 8.5, false) : [];
    const valueHeight = valueLines.length * lineHeight(size);
    const height = CELL_PADDING_TOP + CELL_LABEL_HEIGHT + valueHeight + (noteLines.length ? noteLines.length * lineHeight(8.5) + 0.5 : 0) + CELL_PADDING_BOTTOM;
    return { size, bold, valueLines, noteLines, valueHeight, height };
  };
  const rowHeights = (rows: FormCell[][]) => rows.map((row) => Math.max(...row.map((cell) => cellLayout(cell, contentWidth / row.length).height)));

  const drawHeadingStrip = (title: string, top: number, note?: string) => {
    doc.setFillColor(...PDF_HEADING_FILL);
    doc.rect(PDF_MARGIN, top, contentWidth, HEADING_HEIGHT, 'F');
    write(title.toUpperCase(), PDF_MARGIN + CELL_PADDING_X, top + 1.8, 8, true, PDF_NAVY);
    if (note) write(note, rightEdge - CELL_PADDING_X, top + 2, 7.5, false, PDF_LABEL, 'right');
  };
  const drawFrame = (top: number, height: number) => {
    strokeBorder();
    doc.rect(PDF_MARGIN, top, contentWidth, height);
    doc.line(PDF_MARGIN, top + HEADING_HEIGHT, rightEdge, top + HEADING_HEIGHT);
  };

  /** A titled, bordered block of label-over-value cells, like a section on the Job Order. */
  const cellSection = (title: string, rows: FormCell[][]) => {
    const heights = rowHeights(rows);
    const height = HEADING_HEIGHT + heights.reduce((sum, rowHeight) => sum + rowHeight, 0);
    ensureSpace(height);
    drawHeadingStrip(title, y);
    let rowTop = y + HEADING_HEIGHT;
    rows.forEach((row, rowIndex) => {
      const width = contentWidth / row.length;
      row.forEach((cell, index) => {
        const x = PDF_MARGIN + index * width;
        const layout = cellLayout(cell, width);
        write(cell.label, x + CELL_PADDING_X, rowTop + CELL_PADDING_TOP, 7.5, false, PDF_LABEL);
        const valueTop = rowTop + CELL_PADDING_TOP + CELL_LABEL_HEIGHT;
        write(layout.valueLines, x + CELL_PADDING_X, valueTop, layout.size, layout.bold, isEmpty(cell.value) ? PDF_MUTED : PDF_INK);
        if (layout.noteLines.length) write(layout.noteLines, x + CELL_PADDING_X, valueTop + layout.valueHeight + 0.5, 8.5, false, PDF_LABEL);
        if (index > 0) {
          strokeBorder();
          doc.line(x, rowTop, x, rowTop + heights[rowIndex]);
        }
      });
      rowTop += heights[rowIndex];
      if (rowIndex < rows.length - 1) {
        strokeBorder();
        doc.line(PDF_MARGIN, rowTop, rightEdge, rowTop);
      }
    });
    drawFrame(y, height);
    y += height + SECTION_GAP;
  };

  /** A titled, bordered numbered list. */
  const listSection = (title: string, items: string[], emptyText: string) => {
    const size = 9.5;
    const entries = (items.length ? items : [emptyText]).map((item) => wrap(item, contentWidth - CELL_PADDING_X * 2 - 6, size, false));
    const bodyHeight = entries.reduce((sum, lines) => sum + lines.length * lineHeight(size) + 1.6, 0) + 3;
    ensureSpace(HEADING_HEIGHT + Math.min(bodyHeight, 60));
    const top = y;
    drawHeadingStrip(title, top);
    let lineTop = top + HEADING_HEIGHT + 2.4;
    entries.forEach((lines, index) => {
      if (items.length) write(`${index + 1}.`, PDF_MARGIN + CELL_PADDING_X, lineTop, size, true, PDF_NAVY);
      write(lines, PDF_MARGIN + CELL_PADDING_X + (items.length ? 6 : 0), lineTop, size, false, items.length ? PDF_INK : PDF_MUTED);
      lineTop += lines.length * lineHeight(size) + 1.6;
    });
    drawFrame(top, lineTop - top + 0.6);
    y = lineTop + 0.6 + SECTION_GAP;
  };

  /** A titled table drawn in the same bordered, form-like style. */
  const tableSection = (section: ReportTableSection) => {
    ensureSpace(HEADING_HEIGHT + 22);
    const top = y;
    drawHeadingStrip(section.title, top, section.note);
    strokeBorder();
    doc.rect(PDF_MARGIN, top, contentWidth, HEADING_HEIGHT);
    const numericColumns = section.columns.map((column) => isNumeric(column.format));
    autoTable(doc, {
      startY: top + HEADING_HEIGHT,
      margin: { top: PDF_MARGIN, left: PDF_MARGIN, right: PDF_MARGIN, bottom: PDF_FOOTER_SPACE },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9.5, textColor: PDF_INK, lineColor: PDF_BORDER, lineWidth: 0.25, cellPadding: { top: 2.2, bottom: 2.2, left: CELL_PADDING_X, right: CELL_PADDING_X }, overflow: 'linebreak' },
      headStyles: { fillColor: PDF_WHITE, textColor: PDF_LABEL, fontStyle: 'normal', fontSize: 7.5 },
      bodyStyles: { fillColor: PDF_WHITE },
      footStyles: { fillColor: PDF_WHITE, textColor: PDF_NAVY, fontStyle: 'bold', fontSize: 10.5 },
      head: [section.columns.map((column) => pdfSafe(column.header))],
      body: section.rows.length
        ? section.rows.map((data) => section.columns.map((column) => pdfSafe(formatReportValue(data[column.key] ?? null, column.format))))
        : [[{ content: pdfSafe(section.emptyText ?? 'No records for this period.'), colSpan: section.columns.length, styles: { halign: 'center', fontStyle: 'italic', textColor: PDF_MUTED } }]],
      foot: section.totals && section.rows.length
        ? [section.columns.map((column, index) => {
            const value = section.totals?.[column.key];
            return pdfSafe(value === undefined || value === '' ? (index === 0 ? 'Total' : '') : formatReportValue(value, column.format));
          })]
        : undefined,
      showFoot: 'lastPage',
      showHead: 'everyPage',
      columnStyles: Object.fromEntries(numericColumns.map((numeric, index) => [index, numeric ? { halign: 'right' as const } : {}])),
      didParseCell: (hook) => {
        if (hook.section === 'head' && numericColumns[hook.column.index]) hook.cell.styles.halign = 'right';
        if (hook.section === 'body' && hook.column.index === 0 && section.rows.length) hook.cell.styles.fontStyle = 'bold';
        if (hook.section === 'body' && hook.cell.raw === 'N/A') hook.cell.styles.textColor = PDF_MUTED;
        if (hook.section === 'foot' && hook.column.index === 0) { hook.cell.styles.textColor = PDF_INK; hook.cell.styles.fontSize = 10; }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + SECTION_GAP;
  };

  // Letterhead, as on the Job Order
  doc.setFillColor(...PDF_NAVY);
  doc.rect(PDF_MARGIN, 11, 15, 15, 'F');
  if (logo) doc.addImage(logo, 'PNG', PDF_MARGIN + 0.5, 11.5, 14, 14);
  write(COMPANY, PDF_MARGIN + 18.5, 13, 15, true, PDF_NAVY);
  write(report.period, PDF_MARGIN + 18.5, 20, 10, true, PDF_INK);
  write(report.reportName.toUpperCase(), rightEdge, 11.5, 19, true, PDF_NAVY, 'right');
  write(`Prepared by ${report.generatedBy}`, rightEdge, 20, 8.5, false, PDF_LABEL, 'right');
  doc.setDrawColor(...PDF_NAVY);
  doc.setLineWidth(0.7);
  doc.line(PDF_MARGIN, 29.5, rightEdge, 29.5);
  doc.setDrawColor(...PDF_GOLD);
  doc.setLineWidth(0.5);
  doc.line(PDF_MARGIN, 30.3, rightEdge, 30.3);
  y = 34.5;

  // The period is already in the letterhead. Only mention filters when they narrow the numbers.
  const appliedFilters = report.filters.filter((filter) => !/^all\b/i.test(filter.value));
  if (appliedFilters.length) {
    write(`Filtered by: ${appliedFilters.map((filter) => `${filter.label}: ${filter.value}`).join('  ·  ')}`, PDF_MARGIN, y - 1.5, 8.5, false, PDF_LABEL);
    y += 5;
  }

  for (const section of report.sections) {
    if (section.kind === 'metrics') {
      const rows: FormCell[][] = [];
      for (let index = 0; index < section.items.length; index += METRICS_PER_ROW) {
        rows.push(section.items.slice(index, index + METRICS_PER_ROW).map((item) => ({
          label: item.label, value: formatReportValue(item.value, item.format), note: item.note, size: 12.5, bold: true,
        })));
      }
      cellSection(section.title, rows);
    } else if (section.kind === 'list') {
      listSection(section.title, section.items, section.emptyText ?? 'Nothing to show.');
    } else {
      tableSection(section);
    }
  }

  // Footer, as on the Job Order
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    write(`Generated ${generatedText(report.generatedAt)}  |  WeLinc Booking Management System`, PDF_MARGIN, pageHeight - 9, 7, false, PDF_MUTED);
    write(`Page ${page} of ${pageCount}`, rightEdge, pageHeight - 9, 7, false, PDF_MUTED, 'right');
  }

  doc.save(`welinc-${report.fileStem}-${fileDate(report.generatedAt)}.pdf`);
}
