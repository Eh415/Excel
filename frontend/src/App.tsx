import { useState, useRef } from "react";

type UploadResponse = {
  fileId: string;
  fileName?: string;
  columns: string[];
  preview: Record<string, unknown>[];
  rowCount?: number;
  rowsAfter?: number;
  uniqueValues: Record<string, string[]>;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "/api";

const NONE = "__none__";
const PAGES = ["Upload", "Filter", "Sort", "Download"] as const;
type Page = 0 | 1 | 2 | 3;

export default function App() {
  const [page, setPage] = useState<Page>(0);
  const [fileInfo, setFileInfo] = useState<UploadResponse | null>(null);

  const [filterColumn, setFilterColumn] = useState<string>(NONE);
  const [filterValue, setFilterValue] = useState<string>("");

  const [sortColumn, setSortColumn] = useState<string>(NONE);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [status, setStatus] = useState<"idle" | "uploading" | "sorting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rowCount = fileInfo?.rowsAfter ?? fileInfo?.rowCount ?? 0;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setErrorMsg("");
    setFileInfo(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      setFileInfo(data);
      setFilterColumn(NONE);
      setFilterValue("");
      setSortColumn(NONE);
      setSortOrder("asc");
      setStatus("idle");
      setPage(1);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function handleExportAndDownload() {
    if (!fileInfo) return;

    setStatus("sorting");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: fileInfo.fileId,
          filterColumn: filterColumn === NONE ? undefined : filterColumn,
          filterValue: filterColumn === NONE ? undefined : filterValue,
          sortColumn: sortColumn === NONE ? undefined : sortColumn,
          sortOrder: sortColumn === NONE ? undefined : sortOrder,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sorting failed.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match ? match[1] : "sorted.xlsx";

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Sorting failed.");
    }
  }

  function handleReset() {
    setFileInfo(null);
    setFilterColumn(NONE);
    setFilterValue("");
    setSortColumn(NONE);
    setSortOrder("asc");
    setStatus("idle");
    setErrorMsg("");
    setPage(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function goTo(target: Page) {
    // Can't skip ahead past Upload until a file exists.
    if (target > 0 && !fileInfo) return;
    setPage(target);
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="wordmark">
          <span className="wordmark-mark">
            <span /><span /><span /><span />
          </span>
          Dimension Reduction
        </div>
        <span className="version-tag">local · v1.0</span>
      </header>

      <nav className="stepper" aria-label="Progress">
        {PAGES.map((label, i) => {
          const idx = i as Page;
          const done = fileInfo !== null && idx < page;
          const active = idx === page;
          const reachable = idx === 0 || fileInfo !== null;
          return (
            <button
              key={label}
              type="button"
              className={`step ${active ? "active" : ""} ${done ? "done" : ""}`}
              onClick={() => goTo(idx)}
              disabled={!reachable}
            >
              <span className="num">{i + 1}</span> {label}
            </button>
          );
        })}
      </nav>

      <div className="card page-transition" key={page}>
        {page === 0 && (
          <div className="step-panel">
            <h2>Upload your spreadsheet</h2>
            <p className="lede">
              Upload a spreadsheet, filter and sort by any column, and download a clean copy —
              no formulas, no macros, no waiting on Excel to catch up.
            </p>
            <div className="upload-zone">
              <label className="file-label" htmlFor="file-input">
                .xlsx or .xls, parsed entirely in memory
              </label>
              <input
                id="file-input"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={status === "uploading"}
              />
            </div>
            {status === "uploading" && <p className="status">Reading file…</p>}
            {status === "error" && <p className="status error">{errorMsg}</p>}
          </div>
        )}

        {page === 1 && fileInfo && (
          <div className="step-panel">
            <h2>Filter</h2>
            <p className="meta">
              {rowCount} rows · {fileInfo.columns.length} columns
            </p>
            <p className="meta">Keep only rows where a column equals a value — e.g. Gender = Male. Optional.</p>

            <div className="field-row">
              <label>
                Column
                <select
                  value={filterColumn}
                  onChange={(e) => {
                    setFilterColumn(e.target.value);
                    setFilterValue("");
                  }}
                >
                  <option value={NONE}>No filter</option>
                  {Object.keys(fileInfo.uniqueValues).map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </label>

              {filterColumn !== NONE && (
                <label>
                  Value
                  <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
                    <option value="">Choose a value…</option>
                    {(fileInfo.uniqueValues[filterColumn] || []).map((val) => (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <PreviewTable fileInfo={fileInfo} />

            <div className="actions">
              <button className="secondary" onClick={() => setPage(0)}>
                Back
              </button>
              <button onClick={() => setPage(2)} disabled={filterColumn !== NONE && !filterValue}>
                {filterColumn === NONE ? "Skip & Continue" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {page === 2 && fileInfo && (
          <div className="step-panel">
            <h2>Sort</h2>
            <p className="meta">Optional — choose a column to order the rows by.</p>

            <div className="field-row">
              <label>
                Column
                <select value={sortColumn} onChange={(e) => setSortColumn(e.target.value)}>
                  <option value={NONE}>No sorting</option>
                  {fileInfo.columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </label>

              {sortColumn !== NONE && (
                <label>
                  Order
                  <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}>
                    <option value="asc">Ascending (A→Z, 0→9)</option>
                    <option value="desc">Descending (Z→A, 9→0)</option>
                  </select>
                </label>
              )}
            </div>

            <PreviewTable fileInfo={fileInfo} />

            <div className="actions">
              <button className="secondary" onClick={() => setPage(1)}>
                Back
              </button>
              <button onClick={() => setPage(3)}>
                {sortColumn === NONE ? "Skip & Continue" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {page === 3 && fileInfo && (
          <div className="step-panel">
            <h2>Download</h2>
            <p className="meta">Review your choices, then export a clean copy.</p>

            <div className="section">
              <div className="section-head">
                <h3>Summary</h3>
              </div>
              <p className="meta">
                Filter: {filterColumn === NONE ? "none" : `${filterColumn} = ${filterValue}`}
              </p>
              <p className="meta">
                Sort: {sortColumn === NONE ? "none" : `${sortColumn}, ${sortOrder === "desc" ? "descending" : "ascending"}`}
              </p>
            </div>

            {status === "error" && <p className="status error">{errorMsg}</p>}

            <div className="actions">
              <button className="secondary" onClick={() => setPage(2)}>
                Back
              </button>
              <button onClick={handleExportAndDownload} disabled={status === "sorting"}>
                {status === "sorting" ? "Processing…" : "Apply & Download"}
              </button>
              <button className="secondary" onClick={handleReset}>
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewTable({ fileInfo }: { fileInfo: UploadResponse }) {
  return (
    <>
      <div className="preview-wrap">
        <table className="preview">
          <thead>
            <tr>
              {fileInfo.columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fileInfo.preview.map((row, i) => (
              <tr key={i}>
                {fileInfo.columns.map((col) => (
                  <td key={col}>{String(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="meta small">Preview of first {fileInfo.preview.length} rows</p>
    </>
  );
}
