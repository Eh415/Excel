import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import * as XLSX from "xlsx";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// In-memory store: fileId -> { buffer, sheetName, uploadedAt }
type StoredFile = {
  workbook: XLSX.WorkBook;
  sheetName: string;
  originalName: string;
  uploadedAt: number;
};
const fileStore = new Map<string, StoredFile>();

// Clean up files older than 30 minutes
const FILE_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of fileStore.entries()) {
    if (now - entry.uploadedAt > FILE_TTL_MS) {
      fileStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

// POST /api/upload - accepts an Excel file, returns fileId + columns + preview rows
app.post("/api/upload", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const startedAt = Date.now();

  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    if (rawRows.length === 0) {
      return res.status(400).json({ error: "The uploaded sheet has no data rows." });
    }

    const rowsBefore = rawRows.length;

    // Drop exact duplicate rows (every column value matches another row).
    const seenRowKeys = new Set<string>();
    const rows: Record<string, unknown>[] = [];
    for (const row of rawRows) {
      const key = JSON.stringify(row);
      if (seenRowKeys.has(key)) continue;
      seenRowKeys.add(key);
      rows.push(row);
    }
    const duplicatesRemoved = rowsBefore - rows.length;

    const columns = Object.keys(rows[0]);

    // Count blank/null cells across the cleaned data.
    let nullCells = 0;
    for (const row of rows) {
      for (const col of columns) {
        const val = row[col];
        if (val === "" || val === null || val === undefined) nullCells++;
      }
    }

    const fileId = crypto.randomUUID();

    // Store the deduplicated data so export/sort operate on the cleaned set.
    const cleanedSheet = XLSX.utils.json_to_sheet(rows);
    const cleanedWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(cleanedWorkbook, cleanedSheet, sheetName);

    fileStore.set(fileId, {
      workbook: cleanedWorkbook,
      sheetName,
      originalName: req.file.originalname,
      uploadedAt: Date.now(),
    });

    // For each column, collect its distinct values (capped) so the frontend
    // can offer a "filter by value" dropdown, e.g. Gender -> ["Male", "Female"].
    const MAX_UNIQUE_VALUES = 50;
    const uniqueValues: Record<string, string[]> = {};
    for (const col of columns) {
      const seen = new Set<string>();
      for (const row of rows) {
        const val = String(row[col]).trim();
        if (val !== "") seen.add(val);
        if (seen.size > MAX_UNIQUE_VALUES) break;
      }
      // Only expose as a filter dropdown if it's a reasonably small set of
      // repeated values (categorical), not something like a unique ID/name column.
      if (seen.size > 0 && seen.size <= MAX_UNIQUE_VALUES) {
        uniqueValues[col] = Array.from(seen).sort();
      }
    }

    res.json({
      fileId,
      fileName: req.file.originalname,
      columns,
      preview: rows.slice(0, 5),
      rowsBefore,
      rowsAfter: rows.length,
      duplicatesRemoved,
      nullCells,
      runtimeMs: Date.now() - startedAt,
      uniqueValues,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not parse the uploaded file. Make sure it's a valid .xlsx or .xls file." });
  }
});

// POST /api/export - body: { fileId, filterColumn?, filterValue?, sortColumn?, sortOrder? }
// Filters rows (optional), sorts them (optional), and returns the result as a downloadable .xlsx.
app.post("/api/export", (req: Request, res: Response) => {
  const { fileId, filterColumn, filterValue, sortColumn, sortOrder } = req.body as {
    fileId?: string;
    filterColumn?: string;
    filterValue?: string;
    sortColumn?: string;
    sortOrder?: "asc" | "desc";
  };

  if (!fileId) {
    return res.status(400).json({ error: "fileId is required." });
  }

  const stored = fileStore.get(fileId);
  if (!stored) {
    return res.status(404).json({ error: "File not found or has expired. Please re-upload." });
  }

  try {
    const sheet = stored.workbook.Sheets[stored.sheetName];
    let rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    if (rows.length === 0) {
      return res.status(400).json({ error: "The sheet has no data rows." });
    }

    // --- Filter step (optional) ---
    if (filterColumn) {
      if (!(filterColumn in rows[0])) {
        return res.status(400).json({ error: `Column "${filterColumn}" does not exist in the sheet.` });
      }
      if (filterValue === undefined || filterValue === "") {
        return res.status(400).json({ error: "A filter value is required when filtering by a column." });
      }
      rows = rows.filter(
        (row) => String(row[filterColumn]).trim().toLowerCase() === filterValue.trim().toLowerCase()
      );
      if (rows.length === 0) {
        return res.status(400).json({
          error: `No rows match "${filterColumn} = ${filterValue}".`,
        });
      }
    }

    // --- Sort step (optional) ---
    if (sortColumn) {
      if (!(sortColumn in rows[0])) {
        return res.status(400).json({ error: `Column "${sortColumn}" does not exist in the sheet.` });
      }
      const order = sortOrder === "desc" ? "desc" : "asc";
      rows = [...rows].sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];

        const numA = Number(valA);
        const numB = Number(valB);
        const bothNumeric =
          valA !== "" && valB !== "" && !Number.isNaN(numA) && !Number.isNaN(numB);

        let comparison: number;
        if (bothNumeric) {
          comparison = numA - numB;
        } else {
          comparison = String(valA).localeCompare(String(valB), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }

        return order === "asc" ? comparison : -comparison;
      });
    }

    const newSheet = XLSX.utils.json_to_sheet(rows);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, stored.sheetName);

    const outBuffer = XLSX.write(newWorkbook, { type: "buffer", bookType: "xlsx" });

    const suffixParts = [];
    if (filterColumn) suffixParts.push("filtered");
    if (sortColumn) suffixParts.push("sorted");
    const suffix = suffixParts.length ? suffixParts.join("-") : "export";

    const downloadName = stored.originalName.replace(/(\.xlsx|\.xls)$/i, "") + `-${suffix}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.send(outBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while processing the file." });
  }
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Excel sorter backend running on http://localhost:${PORT}`);
});
