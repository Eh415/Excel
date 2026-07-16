import * as XLSX from "xlsx";

export type ColumnRealignment = {
  label: string;
  fromCol: number;
  toCol: number;
};

export type SmartImportResult = {
  rows: Record<string, unknown>[];
  columns: string[];
  headerRowsSkipped: number;
  groupsDetected: string[];
  dividerRowsRemoved: number;
  subtotalRowsRemoved: number;
  columnsRealigned: ColumnRealignment[];
};

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || String(v).trim() === "";
}

function nonBlankCount(row: unknown[]): number {
  let n = 0;
  for (const v of row) if (!isBlank(v)) n++;
  return n;
}

// Excel serial date -> "YYYY-MM-DD". Excel's epoch is 1899-12-30 (accounting for the
// historical leap-year bug), so serial 25569 corresponds to 1970-01-01 UTC.
function excelSerialToISODate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

// Excel time-of-day fraction (0-1), or the fractional part of a combined date+time serial
// (e.g. 46079.585 = a specific date at ~14:03) -> "HH:MM".
function excelSerialToTime(serial: number): string {
  const fraction = serial - Math.floor(serial);
  const totalMinutes = Math.round(fraction * 24 * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function looksLikeDateColumn(label: string, samples: unknown[]): boolean {
  if (/date/i.test(label)) return true;
  const nums = samples.filter((v) => typeof v === "number") as number[];
  if (nums.length < 3) return false;
  const inRange = nums.filter((n) => n >= 20000 && n <= 60000 && Number.isInteger(n));
  return inRange.length / nums.length > 0.8;
}

function looksLikeTimeColumn(label: string, samples: unknown[]): boolean {
  if (!/time/i.test(label)) return false;
  const nums = samples.filter((v) => typeof v === "number") as number[];
  if (nums.length === 0) return true; // e.g. a Time column that's blank in every sampled row
  // Accept both a pure time-of-day fraction (0-1) and a combined date+time serial (a large
  // number whose fractional part is the time-of-day) — report exports commonly store "Time IN"
  // as a full datetime even though only the time-of-day is meaningful. Reject small decimals
  // like "2.5" (e.g. an hours-worked column), which don't fall in either range.
  const plausible = nums.filter((n) => (n >= 0 && n < 1) || n >= 20000);
  return plausible.length / nums.length > 0.8;
}

/**
 * Cleans up "formatted report" style spreadsheet exports: title/metadata rows before the
 * real header, header labels that don't line up with their data column (common when a
 * report template was designed for print layout rather than as a data table), single-cell
 * "section divider" rows (e.g. a department or company name used as a group heading), and
 * blank-key "subtotal" rows that aggregate the block above them.
 *
 * For an already-clean spreadsheet (header in row 1, one value per column, no dividers or
 * subtotals) this is a no-op: it produces the same rows a plain parse would.
 */
export function smartImport(sheet: XLSX.WorkSheet): SmartImportResult {
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (raw.length === 0) {
    return {
      rows: [],
      columns: [],
      headerRowsSkipped: 0,
      groupsDetected: [],
      dividerRowsRemoved: 0,
      subtotalRowsRemoved: 0,
      columnsRealigned: [],
    };
  }

  // --- 1. Find the real header row: the row with the most non-blank cells among the first
  // few rows. Title/address/date-range rows in report templates typically have 1-2 filled
  // cells; the true header row usually has many more.
  const SCAN_WINDOW = Math.min(30, raw.length);
  let headerRowIdx = 0;
  let bestCount = -1;
  for (let r = 0; r < SCAN_WINDOW; r++) {
    const count = nonBlankCount(raw[r]);
    if (count > bestCount) {
      bestCount = count;
      headerRowIdx = r;
    }
  }

  const headerRow = raw[headerRowIdx] || [];
  const numCols = Math.max(...raw.map((r) => r.length), headerRow.length);

  // --- 2. Sample data rows below the header to measure how "active" (consistently filled)
  // each column actually is.
  const sampleStart = headerRowIdx + 1;
  const sampleEnd = Math.min(raw.length, sampleStart + 60);
  const sampleRows = raw.slice(sampleStart, sampleEnd);

  const columnActivity: number[] = new Array(numCols).fill(0);
  if (sampleRows.length > 0) {
    for (let c = 0; c < numCols; c++) {
      let filled = 0;
      for (const row of sampleRows) if (!isBlank(row[c])) filled++;
      columnActivity[c] = filled / sampleRows.length;
    }
  }

  // --- 3. Map each header label to its real data column. If the header's own column is
  // mostly empty in the sampled data, search nearby columns for one that's actually active
  // and reassign the label there instead.
  const ACTIVE_THRESHOLD = 0.3;
  const claimed = new Set<number>();
  const candidates: { col: number; label: string }[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    const label = String(headerRow[c] ?? "").trim();
    if (label !== "") candidates.push({ col: c, label });
  }

  const mapping: { col: number; label: string }[] = [];
  const columnsRealigned: ColumnRealignment[] = [];

  // First pass: keep well-aligned columns (their own position is already active).
  for (const { col, label } of candidates) {
    if (columnActivity[col] >= ACTIVE_THRESHOLD) {
      mapping.push({ col, label });
      claimed.add(col);
    }
  }

  // Second pass: for misaligned labels, search a small window for the nearest unclaimed
  // active column.
  for (const { col, label } of candidates) {
    if (columnActivity[col] >= ACTIVE_THRESHOLD) continue; // already handled above
    let bestCol: number | null = null;
    let bestActivity = ACTIVE_THRESHOLD;
    for (let offset = 1; offset <= 4; offset++) {
      for (const c of [col - offset, col + offset]) {
        if (c < 0 || c >= numCols || claimed.has(c)) continue;
        if (columnActivity[c] > bestActivity) {
          bestActivity = columnActivity[c];
          bestCol = c;
        }
      }
      if (bestCol !== null) break; // prefer the closest offset that clears the bar
    }
    if (bestCol !== null) {
      mapping.push({ col: bestCol, label });
      claimed.add(bestCol);
      columnsRealigned.push({ label, fromCol: col, toCol: bestCol });
    } else {
      // No better home found — keep it at its original position as a best-effort fallback.
      mapping.push({ col, label });
      claimed.add(col);
    }
  }

  mapping.sort((a, b) => a.col - b.col);
  const columns = mapping.map((m) => m.label);

  // --- 4. Decide which columns need date/time serial conversion, based on sampled values.
  const dateCols = new Set<number>();
  const timeCols = new Set<number>();
  for (const { col, label } of mapping) {
    const samples = sampleRows.map((r) => r[col]).filter((v) => !isBlank(v));
    if (looksLikeDateColumn(label, samples)) dateCols.add(col);
    else if (looksLikeTimeColumn(label, samples)) timeCols.add(col);
  }

  // --- 5. Find the last row that looks like a genuine data record (primary key filled,
  // multiple cells present). Report templates commonly end with a signature/footer block
  // ("Prepared By:", "Noted by:", etc.) made of single-cell rows that would otherwise look
  // identical to a section divider — so anything after the last real record is ignored.
  const primaryCol = mapping.length > 0 ? mapping[0].col : 0;
  let lastDataRowIdx = headerRowIdx;
  for (let r = headerRowIdx + 1; r < raw.length; r++) {
    const row = raw[r];
    if (nonBlankCount(row) >= 2 && !isBlank(row[primaryCol])) lastDataRowIdx = r;
  }

  // --- 6. Pre-scan (within that bound) whether any section dividers exist at all, so every
  // output row consistently has (or doesn't have) a "Group" key rather than it appearing
  // only partway through.
  let anyDividerFound = false;
  for (let r = headerRowIdx + 1; r <= lastDataRowIdx; r++) {
    if (nonBlankCount(raw[r]) === 1) {
      anyDividerFound = true;
      break;
    }
  }

  // --- 7. Walk the data rows (up to the last genuine record), classifying each as: fully
  // blank (skip), a single-cell "section divider" (capture as the current group, skip), a
  // "subtotal" row (primary key blank but other cells filled — skip), or a real record (keep).
  const rows: Record<string, unknown>[] = [];
  const groupsSeen: string[] = [];
  let currentGroup = "";
  let dividerRowsRemoved = 0;
  let subtotalRowsRemoved = 0;

  for (let r = headerRowIdx + 1; r <= lastDataRowIdx; r++) {
    const row = raw[r];
    const filled = nonBlankCount(row);

    if (filled === 0) continue; // blank spacer row

    if (filled === 1) {
      // Section divider: exactly one cell has content, anywhere in the row.
      const val = row.find((v) => !isBlank(v));
      currentGroup = String(val).trim();
      if (!groupsSeen.includes(currentGroup)) groupsSeen.push(currentGroup);
      dividerRowsRemoved++;
      continue;
    }

    if (isBlank(row[primaryCol])) {
      // Multiple cells filled but the primary/key column is blank — treat as a subtotal
      // or summary row rather than an individual record.
      subtotalRowsRemoved++;
      continue;
    }

    const cleanRow: Record<string, unknown> = {};
    for (const { col, label } of mapping) {
      let val = row[col];
      if (!isBlank(val) && typeof val === "number") {
        if (dateCols.has(col)) val = excelSerialToISODate(val);
        else if (timeCols.has(col)) val = excelSerialToTime(val);
      }
      cleanRow[label] = isBlank(val) ? "" : val;
    }
    if (anyDividerFound) cleanRow["Group"] = currentGroup;
    rows.push(cleanRow);
  }

  const finalColumns = anyDividerFound ? [...columns, "Group"] : columns;

  return {
    rows,
    columns: finalColumns,
    headerRowsSkipped: headerRowIdx,
    groupsDetected: groupsSeen,
    dividerRowsRemoved,
    subtotalRowsRemoved,
    columnsRealigned,
  };
}
