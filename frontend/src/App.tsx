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

  return (
    <div className="page">
      <div className="card">
        <h1>Excel Sorter</h1>
        <p className="subtitle">Upload a spreadsheet, choose a column, download it sorted.</p>

        <div className="upload-zone">
          <input
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
              {fileInfo.rowCount} rows detected · {fileInfo.columns.length} columns
            </p>

            <div className="section">
              <h2>Filter (optional)</h2>
              <p className="meta">Only keep rows where a column equals a specific value — e.g. Gender = Male.</p>
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

            <div className="section">
              <h2>Sort (optional)</h2>
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
