import { useState, useRef } from "react";

type UploadResponse = {
  fileId: string;
  fileName: string;
  columns: string[];
  preview: Record<string, unknown>[];
  rowsBefore: number;
  rowsAfter: number;
  duplicatesRemoved: number;
  nullCells: number;
  runtimeMs: number;
  uniqueValues: Record<string, string[]>;
};

function IconUpload() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M12 4L7 9M12 4l5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "/api";

const NONE = "__none__";

export default function App() {
  const [fileInfo, setFileInfo] = useState<UploadResponse | null>(null);

  // Filter (optional): e.g. Gender = Male
  const [filterColumn, setFilterColumn] = useState<string>(NONE);
  const [filterValue, setFilterValue] = useState<string>("");

  // Sort (optional)
  const [sortColumn, setSortColumn] = useState<string>(NONE);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [status, setStatus] = useState<"idle" | "uploading" | "sorting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [proceeded, setProceeded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Result of applying the filter right after upload: null until "Apply filter" is clicked.
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"idle" | "checking" | "error">("idle");
  const [filterError, setFilterError] = useState<string>("");

  async function applyFilter() {
    if (!fileInfo || filterColumn === NONE || !filterValue) return;
    setFilterStatus("checking");
    setFilterError("");
    try {
      const res = await fetch(`${API_BASE}/filter-count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: fileInfo.fileId,
          filterColumn,
          filterValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not apply filter.");
      }
      setFilteredCount(data.rowCount);
      setFilterStatus("idle");
    } catch (err) {
      setFilterStatus("error");
      setFilterError(err instanceof Error ? err.message : "Could not apply filter.");
    }
  }

  function clearFilter() {
    setFilterColumn(NONE);
    setFilterValue("");
    setFilteredCount(null);
    setFilterStatus("idle");
    setFilterError("");
  }

  async function processFile(file: File) {
    setStatus("uploading");
    setErrorMsg("");
    setFileInfo(null);
    setProceeded(false);
    setPreviewOpen(false);
    setFilteredCount(null);
    setFilterStatus("idle");
    setFilterError("");

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
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (status === "uploading" || status === "sorting") return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  }

  async function handleExportAndDownload() {
    if (!fileInfo) return;
    if (filterColumn === NONE && sortColumn === NONE) return;

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
    setProceeded(false);
    setPreviewOpen(false);
    setFilteredCount(null);
    setFilterStatus("idle");
    setFilterError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Stepper state, purely presentational
  const step1Done = !!fileInfo;
  const step2Active = !!fileInfo && !proceeded;
  const step3Active = proceeded;

  return (
    <div className="page">
      <header className="topbar">
        <div className="wordmark">
          <span className="wordmark-mark">
            <span /><span /><span /><span />
          </span>
          Excel Sorter
        </div>
        <span className="version-tag">local · v1.0</span>
      </header>

      <section className="hero">
        <div>
          <h1>
            Rows go in. <em>Order</em> comes out.
          </h1>
          <p className="lede">
            Upload a spreadsheet, filter and sort by any column, and download a clean
            copy — no formulas, no macros, no waiting on Excel to catch up.
          </p>
        </div>
        <div className="sort-signature" aria-hidden="true">
          <span className="sig-label">sorting…</span>
          <div className="sig-bars">
            <span /><span /><span /><span /><span /><span /><span />
          </div>
        </div>
      </section>

      <nav className="stepper" aria-label="Progress">
        <div className={`step ${step1Done ? "done" : "active"}`}>
          <span className="num">1</span> Upload
        </div>
        <div className={`step ${!fileInfo ? "" : step2Active ? "active" : "done"}`}>
          <span className="num">2</span> Review
        </div>
        <div className={`step ${!fileInfo ? "" : step3Active ? "active" : ""}`}>
          <span className="num">3</span> Preprocess
        </div>
        <div className="step">
          <span className="num">4</span> Download
        </div>
      </nav>

      <div
        className={`card upload-card ${isDragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (status !== "uploading" && status !== "sorting") setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div
          className="upload-zone"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <div className="upload-icon">
            <IconUpload />
          </div>
          <p className="upload-title">Drop a spreadsheet here or browse</p>
          <p className="meta">Accepts .xlsx and .xls — parsed entirely in memory, nothing is stored server-side</p>
          <button
            type="button"
            className="browse-btn"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={status === "uploading" || status === "sorting"}
          >
            <IconFile /> Choose file
          </button>
          <input
            id="file-input"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={status === "uploading" || status === "sorting"}
            style={{ display: "none" }}
          />
        </div>

        {status === "uploading" && <p className="status">Reading file…</p>}
        {status === "error" && <p className="status error">{errorMsg}</p>}
      </div>

      {fileInfo && (
        <div className="card dataset-card">
          <div className="dataset-header">
            <span className="dataset-title">Uploaded dataset</span>
          </div>
          <div className="dataset-row">
            <div className="dataset-file">
              <span className="dataset-file-icon">
                <IconFile />
              </span>
              <div>
                <p className="dataset-name">{fileInfo.fileName}</p>
                <p className="meta small">{fileInfo.columns.length} columns</p>
              </div>
            </div>
            <div className="dataset-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPreviewOpen((v) => !v)}
                aria-label={previewOpen ? "Hide preview" : "Show preview"}
              >
                <IconEye />
              </button>
              <button type="button" className="icon-btn danger" onClick={handleReset} aria-label="Remove file">
                <IconTrash />
              </button>
            </div>
          </div>

          <div className="section" style={{ marginBottom: 16 }}>
            <div className="section-head">
              <h2>Filter</h2>
              <span className="section-tag">optional</span>
            </div>
            <p className="meta">Keep only rows where a column equals a value — e.g. Gender = Male.</p>
            <div className="field-row">
              <label>
                Column
                <select
                  value={filterColumn}
                  onChange={(e) => {
                    setFilterColumn(e.target.value);
                    setFilterValue("");
                    setFilteredCount(null);
                    setFilterError("");
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
                  <select
                    value={filterValue}
                    onChange={(e) => {
                      setFilterValue(e.target.value);
                      setFilteredCount(null);
                      setFilterError("");
                    }}
                  >
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

            {filterColumn !== NONE && (
              <div className="filter-apply-row">
                <button
                  type="button"
                  className="secondary small"
                  onClick={applyFilter}
                  disabled={!filterValue || filterStatus === "checking"}
                >
                  {filterStatus === "checking" ? "Filtering…" : "Apply filter"}
                </button>
                {filteredCount !== null && filterStatus !== "checking" && (
                  <button type="button" className="secondary small ghost" onClick={clearFilter}>
                    Clear
                  </button>
                )}
              </div>
            )}
            {filterStatus === "error" && <p className="status error">{filterError}</p>}
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Rows before</span>
              <span className="stat-value">{fileInfo.rowsBefore}</span>
            </div>
            <div className="stat-card highlight">
              <span className="stat-label">Rows after</span>
              <span className="stat-value">{filteredCount !== null ? filteredCount : fileInfo.rowsAfter}</span>
              {filteredCount !== null && <span className="stat-note">filtered</span>}
            </div>
            <div className="stat-card">
              <span className="stat-label">Duplicates removed</span>
              <span className="stat-value">{fileInfo.duplicatesRemoved}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Null / blank cells</span>
              <span className="stat-value">{fileInfo.nullCells}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Runtime</span>
              <span className="stat-value">{fileInfo.runtimeMs} ms</span>
            </div>
          </div>

          {previewOpen && (
            <div className="preview-wrap" style={{ marginTop: 16 }}>
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
          )}

          {!proceeded && (
            <div className="proceed-row">
              <button type="button" className="proceed-btn" onClick={() => setProceeded(true)}>
                Proceed to preprocessing <IconArrowRight />
              </button>
            </div>
          )}
        </div>
      )}

      {fileInfo && proceeded && (
        <div className="card">
          <div className="controls">
            {filterColumn !== NONE && filterValue && (
              <p className="meta filter-reminder">
                Filter active: <strong>{filterColumn} = {filterValue}</strong>
              </p>
            )}
            <div className="section">
              <div className="section-head">
                <h2>Sort</h2>
                <span className="section-tag">optional</span>
              </div>
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
            </div>

            <div className="actions">
              <button
                onClick={handleExportAndDownload}
                disabled={
                  status === "sorting" ||
                  (filterColumn === NONE && sortColumn === NONE) ||
                  (filterColumn !== NONE && !filterValue)
                }
              >
                {status === "sorting" ? "Processing…" : "Apply & Download"}
              </button>
              <button className="secondary" onClick={handleReset}>
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
