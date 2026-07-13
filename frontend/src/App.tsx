import { useState, useRef } from "react";

type UploadResponse = {
  fileId: string;
  columns: string[];
  preview: Record<string, unknown>[];
  rowCount: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "/api";

export default function App() {
  const [fileInfo, setFileInfo] = useState<UploadResponse | null>(null);
  const [column, setColumn] = useState<string>("");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
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
      setColumn(data.columns[0]);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function handleSortAndDownload() {
    if (!fileInfo || !column) return;

    setStatus("sorting");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE}/sort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: fileInfo.fileId, column, order }),
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
    setColumn("");
    setOrder("asc");
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

            <label>
              Sort by column
              <select value={column} onChange={(e) => setColumn(e.target.value)}>
                {fileInfo.columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Order
              <select value={order} onChange={(e) => setOrder(e.target.value as "asc" | "desc")}>
                <option value="asc">Ascending (A→Z, 0→9)</option>
                <option value="desc">Descending (Z→A, 9→0)</option>
              </select>
            </label>

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
              <button onClick={handleSortAndDownload} disabled={status === "sorting"}>
                {status === "sorting" ? "Sorting…" : "Sort & Download"}
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
