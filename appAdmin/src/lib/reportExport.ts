export type ReportExportResult = {
  columns: string[];
  rows: Record<string, string>[];
  rowCount: number;
  truncated?: boolean;
};

export type ReportPdfMeta = {
  reportName: string;
  filterLabel?: string;
  subtitle?: string;
};

export function sanitizeExportFilename(name: string): string {
  const cleaned = name
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return cleaned || 'export';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportReportToCsv(result: ReportExportResult, filename: string) {
  const lines = [
    result.columns.map(escapeCsvCell).join(','),
    ...result.rows.map((row) => result.columns.map((col) => escapeCsvCell(row[col] ?? '')).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportReportToPdf(
  result: ReportExportResult,
  filename: string,
  meta: ReportPdfMeta,
) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const columnCount = result.columns.length;
  const tableFontSize =
    columnCount > 12 ? 6 : columnCount > 8 ? 7 : columnCount > 5 ? 8 : 9;

  let y = 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(99, 91, 255);
  doc.text('vPay Admin', margin, y);
  y += 6;

  doc.setTextColor(26, 26, 46);
  doc.setFontSize(14);
  doc.text(meta.reportName, margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(105, 115, 134);

  const summaryLines: string[] = [];
  if (meta.subtitle?.trim()) summaryLines.push(meta.subtitle.trim());
  if (meta.filterLabel) summaryLines.push(`Date range: ${meta.filterLabel}`);
  summaryLines.push(
    `Generated ${new Date().toLocaleString('en-GB')} · ${result.rowCount} row${result.rowCount === 1 ? '' : 's'}${result.truncated ? ' (truncated)' : ''}`,
  );

  for (const line of summaryLines) {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.5 + 1.5;
  }

  autoTable(doc, {
    head: [result.columns],
    body: result.rows.map((row) => result.columns.map((col) => row[col] ?? '')),
    startY: y + 2,
    margin: { left: margin, right: margin },
    styles: { fontSize: tableFontSize, cellPadding: 1.8, overflow: 'linebreak', textColor: [26, 26, 46] },
    headStyles: { fillColor: [99, 91, 255], textColor: 255, fontStyle: 'bold', fontSize: tableFontSize },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    horizontalPageBreak: true,
  });

  doc.save(`${filename}.pdf`);
}
