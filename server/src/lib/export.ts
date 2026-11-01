import { strToU8, zipSync } from 'fflate';

/**
 * Mencegah CSV formula injection: sel yang dimulai dengan karakter formula
 * diberi prefiks apostrof sebelum dikutip.
 */
export function sanitizeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const needsGuard =
    typeof value === 'string' && /^[=+\-@\t\r]/.test(text);
  const guarded = needsGuard ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((row) => row.map(sanitizeCsvCell).join(',')),
  ];

  // BOM UTF-8 agar Excel membaca karakter Indonesia dengan benar.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export type XlsxColumn = {
  header: string;
  key: string;
  width?: number;
};

export type XlsxRow = Record<string, string | number | null>;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number): string {
  let result = '';
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return cleaned || 'Sheet1';
}

function cellXml(
  value: string | number | null,
  reference: string,
  bold = false,
): string {
  const style = bold ? ' s="1"' : '';

  if (value === null || value === '') {
    return `<c r="${reference}"${style}/>`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"${style}><v>${value}</v></c>`;
  }

  return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(
    String(value),
  )}</t></is></c>`;
}

function worksheetXml(columns: XlsxColumn[], rows: XlsxRow[]): string {
  const columnDefinitions = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${
          column.width ?? 18
        }" customWidth="1"/>`,
    )
    .join('');

  const headerRow = `<row r="1">${columns
    .map((column, index) =>
      cellXml(column.header, `${columnName(index)}1`, true),
    )
    .join('')}</row>`;

  const bodyRows = rows
    .map((row, rowIndex) => {
      const excelRow = rowIndex + 2;
      const cells = columns
        .map((column, columnIndex) =>
          cellXml(
            row[column.key] ?? null,
            `${columnName(columnIndex)}${excelRow}`,
          ),
        )
        .join('');

      return `<row r="${excelRow}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${columnDefinitions}</cols>
<sheetData>${headerRow}${bodyRows}</sheetData>
</worksheet>`;
}

/**
 * Menulis XLSX minimal tanpa parser pihak ketiga yang memproses file eksternal.
 * Semua nilai ditulis sebagai inline string/angka, bukan formula.
 */
export async function toXlsx(
  sheetName: string,
  columns: XlsxColumn[],
  rows: XlsxRow[],
): Promise<Buffer> {
  const safeSheetName = sanitizeSheetName(sheetName);

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(
    safeSheetName,
  )}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const entries: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
    'xl/styles.xml': strToU8(styles),
    'xl/worksheets/sheet1.xml': strToU8(worksheetXml(columns, rows)),
  };

  return Buffer.from(zipSync(entries, { level: 6 }));
}

/**
 * Format tanggal-waktu pada zona waktu kantor: YYYY-MM-DD HH:mm.
 */
export function formatDateTimeInZone(
  value: Date | null,
  timeZone: string,
): string {
  if (!value) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00';

  return `${read('year')}-${read('month')}-${read('day')} ${read('hour')}:${read('minute')}`;
}

export function exportFilename(
  prefix: string,
  from: string,
  to: string,
  format: 'csv' | 'xlsx',
): string {
  return `${prefix}-${from}_${to}.${format}`;
}
