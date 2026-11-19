import { jsPDF } from 'jspdf';

export interface PostServiceDocumentRecord {
  id?: string;
  bookingId?: string;
  bookingNo?: string;
  client?: string | null;
  service?: string | null;
  date?: string | null;
  arrivalTime?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  amountPaid?: string | number | null;
  additionalMaterials?: string[] | string | null;
  completionNotes?: string | null;
  issueReported?: boolean | null;
  issueDetails?: string | null;
}

export interface PostServiceDocumentOptions {
  status: string;
}

interface DocumentDetails {
  bookingNumber: string;
  client: string;
  service: string;
  date: string;
  arrivalTime: string;
  payment: string;
  amountPaid: string;
  status: string;
  additions: string;
  notes: string;
  issue?: string;
  generatedAt: string;
}

const escapeHtml = (value: unknown) => String(value ?? '-').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character] ?? character));

function formatAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const amount = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount)
    ? `PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : String(value);
}

function formatArrivalTime(value?: string | null) {
  if (!value) return '-';
  const timeMatch = value.match(/(?:T|\s)(\d{2}:\d{2})/);
  const time = timeMatch?.[1] ?? value.match(/^(\d{1,2}:\d{2})/)?.[1];
  if (!time) return value;
  const date = new Date(value);
  const storedTimeOnly = /^1970-01-01T/.test(value) && !Number.isNaN(date.getTime());
  const [rawHour, minute] = storedTimeOnly ? [date.getUTCHours(), date.getUTCMinutes()] : time.split(':').map(Number);
  return `${rawHour % 12 || 12}:${String(minute).padStart(2, '0')} ${rawHour >= 12 ? 'PM' : 'AM'}`;
}

function getDetails(record: PostServiceDocumentRecord, options: PostServiceDocumentOptions): DocumentDetails {
  const bookingNumber = String(record.bookingNo ?? '-');
  return {
    bookingNumber,
    client: record.client || '-',
    service: record.service || '-',
    date: record.date || '-',
    arrivalTime: formatArrivalTime(record.arrivalTime),
    payment: `${record.paymentStatus || '-'}${record.paymentMethod ? ` · ${record.paymentMethod}` : ''}`,
    amountPaid: formatAmount(record.amountPaid),
    status: options.status,
    additions: Array.isArray(record.additionalMaterials)
      ? record.additionalMaterials.join(', ') || 'None recorded'
      : record.additionalMaterials || 'None recorded',
    notes: record.completionNotes || 'No notes recorded.',
    issue: record.issueReported ? record.issueDetails || 'No details provided.' : undefined,
    generatedAt: new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }),
  };
}

function printHtml(details: DocumentDetails) {
  const field = (label: string, value: string) => `<div class="field"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Post-Service #${escapeHtml(details.bookingNumber)}</title><style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; } html, body { width: 100%; min-height: 100%; } body { margin: 0; color: #16213e; font-family: "Segoe UI", Arial, sans-serif; background: #fff; }
    .sheet { min-height: 100vh; overflow: hidden; background: #fff; } .hero { padding: 31px 34px 27px; color: #fff; background: #071a52; }
    .eyebrow { margin: 0 0 8px; color: #f7cf68; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; } h1 { margin: 0; font-family: Georgia, serif; font-size: 31px; } .booking { margin: 10px 0 0; font-size: 14px; opacity: .94; }
    .content { padding: 31px 34px 40px; } .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; } .field { min-height: 91px; padding: 17px 19px; border: 1px solid #dce5f2; border-radius: 12px; background: #f8fbff; }
    .label { display: block; margin-bottom: 9px; color: #55708f; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; } .value { color: #102a52; font-size: 16px; font-weight: 700; }
    .notes, .issue { margin-top: 21px; padding: 19px 22px; border-radius: 0 12px 12px 0; } .notes { border-left: 5px solid #e8af34; background: #fff9e9; } .issue { border-left: 5px solid #dc4d59; background: #fff3f4; } .notes p, .issue p { margin: 0; color: #29415e; line-height: 1.55; white-space: pre-wrap; }
    .footer { padding: 15px 34px; color: #5e7894; font-size: 11px; background: #eff6fa; } @media print { .sheet { min-height: 100vh; } }
  </style></head><body><main class="sheet"><header class="hero"><p class="eyebrow">WeLinc Logistics · Service Confirmation</p><h1>Post-Service Record</h1><p class="booking">Booking No.: <strong>${escapeHtml(details.bookingNumber)}</strong></p></header><section class="content"><div class="grid">
  ${field('Client', details.client)}${field('Service', details.service)}${field('Service date', details.date)}${field('Arrival time', details.arrivalTime)}${field('Payment', details.payment)}${field('Amount paid', details.amountPaid)}${field('Completion status', details.status)}${field('Trip add-ons', details.additions)}
  </div><div class="notes"><span class="label">Completion notes</span><p>${escapeHtml(details.notes)}</p></div>${details.issue ? `<div class="issue"><span class="label">Reported issue</span><p>${escapeHtml(details.issue)}</p></div>` : ''}</section><footer class="footer">Generated ${escapeHtml(details.generatedAt)} · WeLinc Booking Management System</footer></main></body></html>`;
}

export function printPostServiceRecord(record: PostServiceDocumentRecord, options: PostServiceDocumentOptions) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Unable to open print window');
  printWindow.document.write(printHtml(getDetails(record, options)));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function downloadPostServicePdf(record: PostServiceDocumentRecord, options: PostServiceDocumentOptions) {
  const details = getDetails(record, options);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 184] });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const navy: [number, number, number] = [32, 32, 112];
  const gold: [number, number, number] = [243, 205, 0];
  const margin = 18;
  const gap = 14;
  const columnWidth = (width - margin * 2 - gap) / 2;
  const lineHeight = 5;
  let y = 59;

  const header = () => {
    doc.setFillColor(...navy); doc.rect(0, 0, width, 43, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...gold);
    doc.text('WELINC LOGISTICS - SERVICE CONFIRMATION', 13, 12);
    doc.setFontSize(19); doc.setTextColor(255, 255, 255);
    doc.text('Post-service record', 13, 24);
    doc.setFontSize(9); doc.text('Booking No.:', 13, 34);
    const labelWidth = doc.getTextWidth('Booking No.: ');
    doc.setTextColor(...gold); doc.text(details.bookingNumber, 13 + labelWidth, 34);
  };
  const nextPage = () => { doc.addPage(); header(); y = 59; };
  header();

  const fields: [string, string][] = [
    ['Client', details.client], ['Service', details.service],
    ['Service date', details.date], ['Arrival time', details.arrivalTime],
    ['Payment', details.payment], ['Amount paid', details.amountPaid],
    ['Completion status', details.status], ['Trip add-ons', details.additions],
  ];
  for (let index = 0; index < fields.length; index += 2) {
    const pair = fields.slice(index, index + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const wrapped = pair.map(([, text]) => doc.splitTextToSize(text, columnWidth - 6) as string[]);
    const count = Math.max(...wrapped.map(lines => lines.length));
    let offset = 0;
    while (offset < count) {
      if (y + 15 > height - 10) nextPage();
      const capacity = Math.max(1, Math.floor((height - 14 - y - 6) / lineHeight));
      const take = Math.min(count - offset, capacity);
      pair.forEach(([label], column) => {
        const x = margin + column * (columnWidth + gap);
        doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        doc.text(label.toUpperCase() + (offset ? ' (CONTINUED)' : ''), x, y);
        const lines = wrapped[column].slice(offset, offset + take);
        if (!lines.length) return;
        const badge = label === 'Completion status';
        if (badge) {
          const status = details.status.toLowerCase();
          const color: [number, number, number] = status.includes('issue') ? [185, 28, 28] : status.includes('complet') ? [21, 128, 61] : [161, 98, 7];
          doc.setFontSize(8); doc.setFont('helvetica', 'bold');
          const badgeLines = lines.map(line => line.toUpperCase());
          const badgeWidth = Math.min(columnWidth, Math.max(...badgeLines.map(line => doc.getTextWidth(line))) + 8);
          doc.setFillColor(...(status.includes('issue') ? [254, 242, 242] : status.includes('complet') ? [240, 253, 244] : [255, 251, 235]) as [number, number, number]);
          doc.setDrawColor(...color); doc.setLineWidth(0.25);
          doc.roundedRect(x, y + 2, badgeWidth, take * lineHeight + 2, 3, 3, 'FD');
          doc.setTextColor(...color); doc.text(badgeLines, x + 4, y + 6, { lineHeightFactor: 1.7 });
        } else {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...navy);
          doc.text(lines, x, y + 7, { lineHeightFactor: 1.4 });
        }
      });
      offset += take;
      y += 7 + take * lineHeight + 12;
      if (offset < count) nextPage();
    }
  }

  const note = (label: string, text: string, issue = false) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const lines = doc.splitTextToSize(text, width - 36) as string[];
    let offset = 0;
    while (offset < lines.length) {
      if (y + 20 > height - 9) nextPage();
      const take = Math.min(lines.length - offset, Math.max(1, Math.floor((height - 15 - y) / lineHeight) - 1));
      doc.setDrawColor(...(issue ? [185, 28, 28] : gold) as [number, number, number]); doc.setLineWidth(0.7);
      doc.line(13, y - 2, 13, y + take * lineHeight + 8);
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text(label + (offset ? ' (CONTINUED)' : ''), 19, y + 4);
      doc.setTextColor(...navy); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(lines.slice(offset, offset + take), 19, y + 11, { lineHeightFactor: 1.5 });
      offset += take; y += take * lineHeight + 18;
      if (offset < lines.length) nextPage();
    }
  };
  note('COMPLETION NOTES', details.notes);
  if (details.issue) note('REPORTED ISSUE', details.issue, true);
  doc.save(`Post-Service-${details.bookingNumber}.pdf`);
}
