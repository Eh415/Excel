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

  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    if (rows.length === 0) {
      return res.status(400).json({ error: "The uploaded sheet has no data rows." });
    }

    const columns = Object.keys(rows[0]);
    const fileId = crypto.randomUUID();

    fileStore.set(fileId, {
      workbook,
      sheetName,
      originalName: req.file.originalname,
      uploadedAt: Date.now(),
    });

    res.json({
      fileId,
      columns,
      preview: rows.slice(0, 5),
      rowCount: rows.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not parse the uploaded file. Make sure it's a valid .xlsx or .xls file." });
  }
});

// POST /api/sort - body: { fileId, column, order }, returns sorted .xlsx as a download
app.post("/api/sort", (req: Request, res: Response) => {
  const { fileId, column, order } = req.body as {
    fileId?: string;
    column?: string;
    order?: "asc" | "desc";
  };

  if (!fileId || !column || !order) {
    return res.status(400).json({ error: "fileId, column, and order are required." });
  }

  const stored = fileStore.get(fileId);
  if (!stored) {
    return res.status(404).json({ error: "File not found or has expired. Please re-upload." });
  }

  try {
    const sheet = stored.workbook.Sheets[stored.sheetName];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    if (!(column in rows[0])) {
      return res.status(400).json({ error: `Column "${column}" does not exist in the sheet.` });
    }

    const sorted = [...rows].sort((a, b) => {
      const valA = a[column];
      const valB = b[column];

      // Numeric comparison when both values are numbers (or numeric strings)
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

    const newSheet = XLSX.utils.json_to_sheet(sorted);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, stored.sheetName);

    const outBuffer = XLSX.write(newWorkbook, { type: "buffer", bookType: "xlsx" });

    const downloadName = stored.originalName.replace(/(\.xlsx|\.xls)$/i, "") + "-sorted.xlsx";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.send(outBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong while sorting the file." });
  }
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Excel sorter backend running on http://localhost:${PORT}`);
});
