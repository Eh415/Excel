import { useState, useRef } from "react";

type UploadResponse = {
  fileId: string;
  columns: string[];
  preview: Record<string, unknown>[];
  rowCount: number;
  uniqueValues: Record<string, string[]>;
};

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
    }
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Stepper state, purely presentational
  const step1Done = !!fileInfo;
  const step2Active = !!fileInfo && filterColumn === NONE && sortColumn === NONE;
  const step3Active = !!fileInfo && (filterColumn !== NONE || sortColumn !== NONE);

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
          <span className="num">2</span> Filter
        </div>
        <div className={`step ${!fileInfo ? "" : step3Active ? "active" : ""}`}>
          <span className="num">3</span> Sort
        </div>
        <div className="step">
          <span className="num">4</span> Download
        </div>
      </nav>

      <div className="card">
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
            disabled={status === "uploading" || status === "sorting"}
          />
        </div>

        {status === "uploading" && <p className="status">Reading file…</p>}
        {status === "error" && <p className="status error">{errorMsg}</p>}

        {fileInfo && (
          <div className="controls">
            <p className="meta">
              {fileInfo.rowCount} rows · {fileInfo.columns.length} columns
            </p>

            <div className="section">
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
            </div>

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
        )}
      </div>
    </div>
  );
}
