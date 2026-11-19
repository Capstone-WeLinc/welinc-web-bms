import { jsPDF } from 'jspdf';

export interface JobOrderSheet {
  /** Image data URL for the letterhead. The tile stays plain navy without it. */
  logo?: string | null;
  jobOrderNo: string;
  bookingNo: string;
  date: string;
  pickupTime: string;
  dispatchTime: string;
  vehiclePlate: string;
  vehicleModel: string;
  garage: string;
  driver: string;
  helpers: string[];
  pickupAddress: string;
  pickupLandmark?: string;
  dropOffAddress: string;
  dropOffLandmark?: string;
  client: string;
  contact: string;
  service: string;
  items: string;
  specialInstructions: string;
  permitRequired: boolean;
  /** Everything the customer booked, with its price: truck, services, materials, insurance and surcharges. */
  costLines: Array<{ label: string; value: string; muted?: boolean }>;
  paymentMethod: string;
  paymentStatus: string;
  isCashPayment: boolean;
  totalAmount: number;
  amountDue: number;
}

type Rgb = [number, number, number];
type Cell = { label: string; value: string; size?: number; bold?: boolean; note?: string; fill?: Rgb };

const NAVY: Rgb = [26, 31, 110];
const GOLD: Rgb = [232, 184, 0];
const WHITE: Rgb = [255, 255, 255];
const INK: Rgb = [15, 23, 42];
const LABEL: Rgb = [100, 116, 139];
const MUTED: Rgb = [148, 163, 184];
const BORDER: Rgb = [203, 213, 225];
const HEADING_FILL: Rgb = [241, 244, 250];
const HIGHLIGHT_FILL: Rgb = [254, 249, 225];
const NOTE_FILL: Rgb = [255, 251, 235];
const NOTE_ACCENT: Rgb = [217, 119, 6];
const NOTE_INK: Rgb = [120, 53, 15];
const RED: Rgb = [185, 28, 28];

const PAGE_MARGIN = 15;
const PAGE_BOTTOM = 283;
const HEADING_HEIGHT = 6.5;
const CELL_PADDING_X = 3;
const CELL_PADDING_TOP = 2.2;
const CELL_PADDING_BOTTOM = 2.4;
const CELL_LABEL_HEIGHT = 4;
const MM_PER_POINT = 0.3528;

export function formatJobOrderDate(value?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return value || '-';
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatJobOrderTime(value?: string) {
  if (!value || value === '-') return value || '-';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function deduplicateAddress(value?: string) {
  if (!value || value === '-') return value || '-';
  const seen = new Set<string>();
  return value.split(',').map(part => part.trim()).filter(part => {
    const normalized = part.toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).join(', ');
}

/** Shrinks the site logo for the letterhead so it doesn't bloat every PDF. Resolves to null if it can't load. */
export function loadJobOrderLogo(): Promise<string | null> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const context = canvas.getContext('2d');
      if (!context) { resolve(null); return; }
      context.drawImage(image, 0, 0, 200, 200);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(null);
    image.src = '/logo.png';
  });
}

// The built-in PDF fonts only cover Latin-1, which has no peso sign.
const printable = (value: string) => value
  .replace(/₱/g, 'PHP ')
  .replace(/[–—]/g, '-')
  .replace(/[^\n\x20-\xFF]/g, '')
  .replace(/[ \t]+/g, ' ')
  .trim();

const peso = (amount: number) => `PHP ${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

function collectionBand(sheet: JobOrderSheet) {
  if (sheet.paymentStatus === 'Paid' || sheet.amountDue <= 0) return { label: 'NOTHING TO COLLECT', value: 'PAID' };
  if (sheet.isCashPayment) return { label: 'COLLECT FROM CLIENT (CASH)', value: peso(sheet.amountDue) };
  const method = sheet.paymentMethod === 'Not set' ? '' : ` (${sheet.paymentMethod})`;
  return { label: `BALANCE TO SETTLE${method}`, value: peso(sheet.amountDue) };
}

/** One-page form the driver carries: when, who, warnings, where to go, who to call, and what to collect. Only very full jobs lose spacing. */
export function buildJobOrderPdf(sheet: JobOrderSheet) {
  let doc = drawJobOrder(sheet, 4.5);
  for (const sectionGap of [3.5, 2.5, 1.5]) {
    if (doc.getNumberOfPages() === 1) break;
    doc = drawJobOrder(sheet, sectionGap);
  }
  return doc;
}

function drawJobOrder(sheet: JobOrderSheet, sectionGap: number) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const rightEdge = pageWidth - PAGE_MARGIN;
  let y = 0;

  const applyDocumentFont = (size: number, bold: boolean) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
  };
  const lineHeight = (size: number) => size * MM_PER_POINT * 1.25;
  const wrap = (value: string, width: number, size: number, bold: boolean): string[] => {
    applyDocumentFont(size, bold);
    return doc.splitTextToSize(printable(value) || '-', width);
  };
  const write = (value: string | string[], x: number, top: number, size: number, bold: boolean, color: Rgb, align: 'left' | 'right' = 'left') => {
    applyDocumentFont(size, bold);
    doc.setTextColor(...color);
    doc.setLineHeightFactor(1.25);
    doc.text(typeof value === 'string' ? printable(value) : value, x, top + size * MM_PER_POINT, { align });
  };
  const ensureSpace = (height: number) => {
    if (y + height <= PAGE_BOTTOM) return;
    doc.addPage();
    y = PAGE_MARGIN;
  };
  const strokeBorder = () => {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
  };

  const isEmpty = (value: string) => !value || value === '-' || value === 'Not set' || value === 'None';
  const cellLayout = (cell: Cell, width: number) => {
    const size = cell.size ?? 10;
    const bold = !!cell.bold && !isEmpty(cell.value);
    const innerWidth = width - CELL_PADDING_X * 2;
    const valueLines = wrap(cell.value, innerWidth, size, bold);
    const noteLines = cell.note ? wrap(cell.note, innerWidth, 8.5, false) : [];
    const valueHeight = valueLines.length * lineHeight(size);
    const height = CELL_PADDING_TOP + CELL_LABEL_HEIGHT + valueHeight
      + (noteLines.length ? noteLines.length * lineHeight(8.5) + 0.5 : 0) + CELL_PADDING_BOTTOM;
    return { size, bold, valueLines, noteLines, valueHeight, height };
  };
  const rowHeights = (rows: Cell[][], boxWidth: number) => rows.map(row => Math.max(...row.map(cell => cellLayout(cell, boxWidth / row.length).height)));

  const drawBoxFrame = (title: string, boxX: number, boxWidth: number, top: number, height: number) => {
    doc.setFillColor(...HEADING_FILL);
    doc.rect(boxX, top, boxWidth, HEADING_HEIGHT, 'F');
    write(title.toUpperCase(), boxX + CELL_PADDING_X, top + 1.8, 8, true, NAVY);
    strokeBorder();
    doc.rect(boxX, top, boxWidth, height);
    doc.line(boxX, top + HEADING_HEIGHT, boxX + boxWidth, top + HEADING_HEIGHT);
  };

  // A titled, bordered block of cells, like a section on a printed form.
  const drawCellBox = (title: string, rows: Cell[][], boxX: number, boxWidth: number, top: number, boxHeight: number) => {
    const heights = rowHeights(rows, boxWidth);
    let rowTop = top + HEADING_HEIGHT;
    rows.forEach((row, rowIndex) => {
      const width = boxWidth / row.length;
      row.forEach((cell, index) => {
        const x = boxX + index * width;
        const layout = cellLayout(cell, width);
        if (cell.fill) {
          doc.setFillColor(...cell.fill);
          doc.rect(x, rowTop, width, heights[rowIndex], 'F');
        }
        write(cell.label, x + CELL_PADDING_X, rowTop + CELL_PADDING_TOP, 7.5, false, LABEL);
        const valueTop = rowTop + CELL_PADDING_TOP + CELL_LABEL_HEIGHT;
        write(layout.valueLines, x + CELL_PADDING_X, valueTop, layout.size, layout.bold, isEmpty(cell.value) ? MUTED : INK);
        if (layout.noteLines.length) write(layout.noteLines, x + CELL_PADDING_X, valueTop + layout.valueHeight + 0.5, 8.5, false, LABEL);
        if (index > 0) {
          strokeBorder();
          doc.line(x, rowTop, x, rowTop + heights[rowIndex]);
        }
      });
      rowTop += heights[rowIndex];
      if (rowIndex < rows.length - 1) {
        strokeBorder();
        doc.line(boxX, rowTop, boxX + boxWidth, rowTop);
      }
    });
    drawBoxFrame(title, boxX, boxWidth, top, boxHeight);
  };

  const section = (title: string, rows: Cell[][]) => {
    const height = HEADING_HEIGHT + rowHeights(rows, contentWidth).reduce((sum, rowHeight) => sum + rowHeight, 0);
    ensureSpace(height);
    drawCellBox(title, rows, PAGE_MARGIN, contentWidth, y, height);
    y += height + sectionGap;
  };

  // Letterhead
  doc.setFillColor(...NAVY);
  doc.rect(PAGE_MARGIN, 11, 15, 15, 'F');
  if (sheet.logo) doc.addImage(sheet.logo, 'PNG', PAGE_MARGIN + 0.5, 11.5, 14, 14);
  write('WeLinc Logistics', PAGE_MARGIN + 18.5, 13, 15, true, NAVY);
  write(`No. ${sheet.jobOrderNo}`, PAGE_MARGIN + 18.5, 20, 10, true, INK);
  write('JOB ORDER', rightEdge, 11.5, 19, true, NAVY, 'right');
  write(`Booking ${sheet.bookingNo}`, rightEdge, 20, 8.5, false, LABEL, 'right');
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.line(PAGE_MARGIN, 29.5, rightEdge, 29.5);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, 30.3, rightEdge, 30.3);
  y = 34.5;

  section('Client details', [[
    { label: 'Client', value: sheet.client },
    { label: 'Contact number', value: sheet.contact, bold: true },
  ]]);

  section('Schedule', [[
    { label: 'Date', value: sheet.date, size: 12.5, bold: true },
    { label: 'Pickup time', value: sheet.pickupTime, size: 12.5, bold: true, fill: HIGHLIGHT_FILL },
    { label: 'Dispatch time', value: sheet.dispatchTime, size: 12.5, bold: true },
  ]]);

  const vehicleNote = [sheet.vehicleModel, sheet.garage && `Garage: ${sheet.garage}`].filter(Boolean).join(' | ');
  section('Vehicle and crew', [[
    { label: 'Driver', value: sheet.driver, size: 12, bold: true },
    { label: 'Vehicle', value: sheet.vehiclePlate, size: 12, bold: true, note: vehicleNote || undefined },
    { label: 'Helper/s', value: sheet.helpers.join(', ') || 'None' },
  ]]);

  // Important notes, so warnings are read before the driver sets off
  const hasInstructions = !!sheet.specialInstructions && sheet.specialInstructions !== 'None';
  if (hasInstructions || sheet.permitRequired) {
    const noteLines = hasInstructions ? wrap(sheet.specialInstructions, contentWidth - 9, 10, false) : [];
    const permitHeight = sheet.permitRequired ? lineHeight(10) + (noteLines.length ? 0.8 : 0) : 0;
    const height = 8.5 + permitHeight + noteLines.length * lineHeight(10) + 2.4;
    ensureSpace(height);
    doc.setFillColor(...NOTE_FILL);
    doc.rect(PAGE_MARGIN, y, contentWidth, height, 'F');
    doc.setFillColor(...NOTE_ACCENT);
    doc.rect(PAGE_MARGIN, y, 1.2, height, 'F');
    write('IMPORTANT NOTES', PAGE_MARGIN + 4, y + 2.4, 8, true, NOTE_INK);
    if (sheet.permitRequired) write('Barangay / subdivision permit required', PAGE_MARGIN + 4, y + 7, 10, true, RED);
    if (noteLines.length) write(noteLines, PAGE_MARGIN + 4, y + 7 + permitHeight, 10, false, NOTE_INK);
    y += height + sectionGap;
  }

  section('Route', [
    [{ label: 'Pickup address', value: sheet.pickupAddress, size: 10.5, bold: true, note: sheet.pickupLandmark?.trim() ? `Landmark / Map Pin: ${sheet.pickupLandmark.trim()}` : undefined }],
    [{ label: 'Drop-off address', value: sheet.dropOffAddress, size: 10.5, bold: true, note: sheet.dropOffLandmark?.trim() ? `Landmark / Map Pin: ${sheet.dropOffLandmark.trim()}` : undefined }],
  ]);

  // Job details beside payment details, which is the one list of everything the customer booked.
  const boxGap = 4;
  const jobWidth = contentWidth * 0.42;
  const costX = PAGE_MARGIN + jobWidth + boxGap;
  const costWidth = contentWidth - jobWidth - boxGap;
  const costLabelWidth = costWidth - CELL_PADDING_X * 2 - 26;
  const jobRows: Cell[][] = [
    [{ label: 'Service', value: sheet.service }],
    [{ label: 'Items', value: sheet.items }],
    [{ label: 'Payment Method', value: sheet.paymentMethod }],
  ];
  const jobHeight = HEADING_HEIGHT + rowHeights(jobRows, jobWidth).reduce((sum, rowHeight) => sum + rowHeight, 0);
  const costRows = sheet.costLines.map(line => ({ ...line, lines: wrap(line.label, costLabelWidth, 9.5, false) }));
  const costRowsHeight = costRows.reduce((sum, row) => sum + row.lines.length * lineHeight(9.5) + 1, 0);
  const totalRowHeight = 8.5;
  const costHeight = HEADING_HEIGHT + 2 + costRowsHeight + totalRowHeight;
  const detailsHeight = Math.max(jobHeight, costHeight);
  ensureSpace(detailsHeight);
  drawCellBox('Job details', jobRows, PAGE_MARGIN, jobWidth, y, detailsHeight);
  let costY = y + HEADING_HEIGHT + 2;
  costRows.forEach(row => {
    write(row.lines, costX + CELL_PADDING_X, costY, 9.5, false, INK);
    write(row.value, costX + costWidth - CELL_PADDING_X, costY, 9.5, false, row.muted ? MUTED : INK, 'right');
    costY += row.lines.length * lineHeight(9.5) + 1;
  });
  const totalTop = y + detailsHeight - totalRowHeight;
  write('Total', costX + CELL_PADDING_X, totalTop + 2.6, 10, true, INK);
  write(peso(sheet.totalAmount), costX + costWidth - CELL_PADDING_X, totalTop + 2, 12, true, NAVY, 'right');
  strokeBorder();
  doc.line(costX, totalTop, costX + costWidth, totalTop);
  drawBoxFrame('Payment details', costX, costWidth, y, detailsHeight);
  y += detailsHeight + sectionGap;

  // What the driver has to collect
  const band = collectionBand(sheet);
  ensureSpace(12);
  doc.setFillColor(...NAVY);
  doc.rect(PAGE_MARGIN, y, contentWidth, 12, 'F');
  write(band.label, PAGE_MARGIN + CELL_PADDING_X + 1, y + 4.2, 10, true, WHITE);
  write(band.value, rightEdge - CELL_PADDING_X - 1, y + 3, 15, true, WHITE, 'right');
  y += 12 + sectionGap;

  // Sign-off
  ensureSpace(18);
  const signatureGap = 8;
  const signatureWidth = (contentWidth - signatureGap) / 2;
  y += Math.max(0, 7 - sectionGap);
  ['Prepared by (Operations)', 'Received by (Driver)'].forEach((label, index) => {
    const x = PAGE_MARGIN + index * (signatureWidth + signatureGap);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.25);
    doc.line(x, y + 7, x + signatureWidth, y + 7);
    write(label, x, y + 8, 8, false, LABEL);
    write('Signature over printed name / date', x, y + 11.2, 6.5, false, MUTED);
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    write(`Generated ${new Date().toLocaleString('en-PH')}  |  WeLinc Booking Management System`, PAGE_MARGIN, 288, 7, false, MUTED);
    write(`Page ${page} of ${pageCount}`, rightEdge, 288, 7, false, MUTED, 'right');
  }
  return doc;
}
