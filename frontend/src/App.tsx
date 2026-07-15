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

function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

function IconFilterGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16l-6 8v5l-4 2v-7L4 5Z" />
    </svg>
  );
}

function IconSortGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4v16M7 4 3 8M7 4l4 4" />
      <path d="M17 20V4M17 20l4-4M17 20l-4-4" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5" />
    </svg>
  );
}

type AlgorithmComponent = { label: string; ratio: number };
type ScatterPoint = { class: string; x: number; y: number };
type AlgorithmsResponse = {
  numericColumns: string[];
  rowsUsed: number;
  pca: { components: AlgorithmComponent[]; columnNames: string[]; scores: number[][] };
  lda: {
    labelColumn: string;
    classes: string[];
    components: AlgorithmComponent[];
    accuracy: number | null;
    testSetSize: number;
    note?: string;
    columnNames: string[];
    scatter: ScatterPoint[];
  };
};

const CLASS_COLORS = ["#35604A", "#C4531D", "#3B5D8A", "#7A5FA0", "#B8952E", "#4B7A6B"];

function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4Z" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "/api";

const NONE = "__none__";

function LdaScatter({
  scatter,
  classes,
  numericColumns,
  labelColumn,
  accuracy,
  ld1Ratio,
}: {
  scatter: ScatterPoint[];
  classes: string[];
  numericColumns: string[];
  labelColumn: string;
  accuracy: number | null;
  ld1Ratio?: number;
}) {
  const width = 560;
  const height = 300;
  const pad = 36;

  const xs = scatter.map((p) => p.x);
  const ys = scatter.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);
  const minY = yRange < 1e-6 ? -1 : Math.min(...ys);
  const maxY = yRange < 1e-6 ? 1 : Math.max(...ys);

  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;

  const toSvgX = (x: number) => pad + ((x - minX) / xSpan) * (width - pad * 2);
  const toSvgY = (y: number) => height - pad - ((y - minY) / ySpan) * (height - pad * 2);

  const colorFor = (cls: string) => CLASS_COLORS[classes.indexOf(cls) % CLASS_COLORS.length];

  return (
    <div className="analysis-panel">
      <p className="meta">
        Using <strong>{numericColumns.join(", ")}</strong>, LDA separates {classes.length} classes of{" "}
        <strong>{labelColumn}</strong>
        {accuracy !== null ? <> with {accuracy.toFixed(1)}% held-out accuracy</> : null}
        {ld1Ratio !== undefined ? (
          <>
            . LD1 alone captures {ld1Ratio.toFixed(1)}% of the between-class separation
          </>
        ) : null}
        .
      </p>

      <div className="scatter-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="scatter-svg">
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="scatter-axis" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="scatter-axis" />
          <text x={width / 2} y={height - 8} className="scatter-axis-label" textAnchor="middle">
            LD1
          </text>
          <text
            x={-height / 2}
            y={14}
            className="scatter-axis-label"
            textAnchor="middle"
            transform="rotate(-90)"
          >
            LD2
          </text>
          {scatter.map((p, i) => (
            <circle
              key={i}
              cx={toSvgX(p.x)}
              cy={toSvgY(p.y)}
              r={4}
              fill={colorFor(p.class)}
              fillOpacity={0.75}
              stroke="#fff"
              strokeWidth={0.5}
            />
          ))}
        </svg>
      </div>

      <div className="scatter-legend">
        {classes.map((c) => (
          <span className="legend-item" key={c}>
            <span className="legend-swatch" style={{ background: colorFor(c) }} />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

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

  // Apply Algorithms (PCA + LDA), run after preprocessing.
  const [algoOpen, setAlgoOpen] = useState(false);
  const [labelColumn, setLabelColumn] = useState<string>(NONE);
  const [algoStatus, setAlgoStatus] = useState<"idle" | "running" | "error">("idle");
  const [algoError, setAlgoError] = useState<string>("");
  const [algoResult, setAlgoResult] = useState<AlgorithmsResponse | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  async function runAlgorithmsRequest() {
    if (!fileInfo || labelColumn === NONE) return;
    setAlgoStatus("running");
    setAlgoError("");
    setAlgoResult(null);
    setAnalysisOpen(false);
    try {
      const res = await fetch(`${API_BASE}/apply-algorithms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: fileInfo.fileId,
          labelColumn,
          filterColumn: filterColumn === NONE ? undefined : filterColumn,
          filterValue: filterColumn === NONE ? undefined : filterValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not run algorithms.");
      }
      setAlgoResult(data);
      setAlgoStatus("idle");
    } catch (err) {
      setAlgoStatus("error");
      setAlgoError(err instanceof Error ? err.message : "Could not run algorithms.");
    }
  }

  function resetAlgorithms() {
    setAlgoOpen(false);
    setLabelColumn(NONE);
    setAlgoStatus("idle");
    setAlgoError("");
    // If the current sort was set to an algorithm-output column (PC1, LD1, ...), it won't exist
    // anymore once results are cleared — fall back to no sorting rather than leaving a dangling value.
    if (fileInfo && !fileInfo.columns.includes(sortColumn) && sortColumn !== NONE) {
      setSortColumn(NONE);
    }
    setAlgoResult(null);
    setAnalysisOpen(false);
    setDownloaded(false);
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
    setDownloaded(false);
    resetAlgorithms();

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
    if (!algoResult) return; // Apply Algorithms must run first — its results are merged into the download.

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
          labelColumn: algoResult.lda.labelColumn,
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
      setDownloaded(true);
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
    resetAlgorithms();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Sidebar progress state, purely presentational
  type StepStatus = "done" | "active" | "upcoming";
  const steps: { n: number; label: string; status: StepStatus }[] = [
    { n: 1, label: "Upload", status: fileInfo ? "done" : "active" },
    {
      n: 2,
      label: "Review",
      status: !fileInfo ? "upcoming" : proceeded ? "done" : "active",
    },
    {
      n: 3,
      label: "Preprocess",
      status: !proceeded ? "upcoming" : algoOpen || algoResult ? "done" : "active",
    },
    {
      n: 4,
      label: "Algorithms",
      status: !proceeded ? "upcoming" : algoResult ? "done" : algoOpen ? "active" : "upcoming",
    },
    {
      n: 5,
      label: "Download",
      status: !algoResult ? "upcoming" : downloaded ? "done" : "active",
    },
  ];

  function nextStepHint(): string {
    if (!fileInfo) return "Upload a spreadsheet to get started.";
    if (!proceeded) return "Review the file below. Filtering is optional — click Proceed to preprocessing when ready.";
    if (!algoOpen && !algoResult)
      return "Choose a sort order if you'd like, then click Apply Algorithms — it's required before you can download.";
    if (algoOpen && !algoResult) return "Pick a class/label column for LDA, then click Run Algorithms.";
    if (algoResult && !downloaded)
      return "You're ready — click Apply & Download to get your file with PC1/PC2/LD1/LD2 included.";
    return "Done! Upload another file to start over, or download again anytime.";
  }

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

      <div className="workspace">
        <aside className="sidebar" aria-label="Progress">
          <p className="sidebar-title">Process</p>
          <ol className="sidebar-steps">
            {steps.map((s) => (
              <li key={s.n} className={`sidebar-step ${s.status}`}>
                <span className="sidebar-step-marker">
                  {s.status === "done" ? <IconCheckCircle /> : s.n}
                </span>
                <span className="sidebar-step-label">{s.label}</span>
              </li>
            ))}
          </ol>
          <div className="sidebar-next">
            <p className="sidebar-next-label">What's next</p>
            <p className="sidebar-next-text">{nextStepHint()}</p>
          </div>
        </aside>

        <nav className="stepper-mobile" aria-label="Progress">
          {steps.map((s) => (
            <div key={s.n} className={`step ${s.status === "active" ? "active" : s.status === "done" ? "done" : ""}`}>
              <span className="num">{s.n}</span> {s.label}
            </div>
          ))}
        </nav>

        <div className="main-content">

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
                    resetAlgorithms();
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
                    {algoResult && (
                      <optgroup label="From Apply Algorithms">
                        {[...algoResult.pca.columnNames, ...algoResult.lda.columnNames].map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </optgroup>
                    )}
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

            {!algoResult && (
              <p className="meta small download-lock-note">
                Run <strong>Apply Algorithms</strong> below first — the download will include PC1/PC2 (PCA) and LD1/LD2 (LDA) columns.
              </p>
            )}

            <div className="actions">
              <button
                onClick={handleExportAndDownload}
                disabled={
                  status === "sorting" ||
                  !algoResult ||
                  (filterColumn !== NONE && !filterValue)
                }
              >
                {status === "sorting" ? "Processing…" : "Apply & Download"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setAlgoOpen(true)}
                disabled={algoOpen}
              >
                {algoResult ? "Re-run Algorithms" : "Apply Algorithms"}
              </button>
              <button className="secondary" onClick={handleReset}>
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {fileInfo && proceeded && algoOpen && (
        <div className="card algo-card">
          <div className="algo-header">
            <span className="algo-header-icon">
              <IconSparkle />
            </span>
            <div>
              <h2 className="algo-title">Apply Algorithms</h2>
              <p className="meta">Run PCA and LDA dimensionality reduction on the numeric columns.</p>
            </div>
          </div>

          {!algoResult && (
            <div className="section" style={{ marginTop: 4 }}>
              <div className="field-row">
                <label>
                  Class / label column (for LDA)
                  <select
                    value={labelColumn}
                    onChange={(e) => {
                      setLabelColumn(e.target.value);
                      setAlgoResult(null);
                      setAlgoStatus("idle");
                      setAlgoError("");
                    }}
                  >
                    <option value={NONE}>Choose a column…</option>
                    {Object.keys(fileInfo.uniqueValues)
                      .filter((col) => col !== filterColumn || filterColumn === NONE)
                      .map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <p className="meta small">
                PCA runs unsupervised on all numeric columns. LDA additionally uses this column as the class label.
              </p>
              <div className="filter-apply-row">
                <button
                  type="button"
                  onClick={runAlgorithmsRequest}
                  disabled={labelColumn === NONE || algoStatus === "running"}
                >
                  {algoStatus === "running" ? "Running…" : "Run Algorithms"}
                </button>
                <button type="button" className="secondary small ghost" onClick={resetAlgorithms}>
                  Cancel
                </button>
              </div>
              {algoStatus === "error" && <p className="status error">{algoError}</p>}
            </div>
          )}

          {algoResult && (
            <>
              <div className="algo-grid">
                <div className="algo-result-card">
                  <div className="algo-result-head">
                    <span className="algo-icon pine">
                      <IconSparkle />
                    </span>
                    <div>
                      <p className="algo-result-title">PCA</p>
                      <p className="algo-result-subtitle">Principal Component Analysis</p>
                    </div>
                  </div>
                  <p className="meta">Unsupervised linear transformation to maximize variance retention.</p>
                  <span className="algo-status-badge done">
                    <IconCheckCircle /> Completed
                  </span>
                  <div className="algo-bars">
                    {algoResult.pca.components.map((c) => (
                      <div className="algo-bar-row" key={c.label}>
                        <span className="algo-bar-label">{c.label}</span>
                        <span className="algo-bar-track">
                          <span className="algo-bar-fill" style={{ width: `${Math.min(c.ratio, 100)}%` }} />
                        </span>
                        <span className="algo-bar-value">{c.ratio.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="algo-result-card">
                  <div className="algo-result-head">
                    <span className="algo-icon clay">
                      <IconTarget />
                    </span>
                    <div>
                      <p className="algo-result-title">LDA</p>
                      <p className="algo-result-subtitle">Linear Discriminant Analysis</p>
                    </div>
                  </div>
                  <p className="meta">
                    Supervised method to maximize separability of <strong>{algoResult.lda.labelColumn}</strong>.
                  </p>
                  <span className="algo-status-badge done">
                    <IconCheckCircle /> Completed
                  </span>
                  <div className="algo-bars">
                    {algoResult.lda.accuracy !== null && (
                      <div className="algo-bar-row accuracy">
                        <span className="algo-bar-label">Accuracy</span>
                        <span className="algo-bar-track" />
                        <span className="algo-bar-value">{algoResult.lda.accuracy.toFixed(1)}%</span>
                      </div>
                    )}
                    {algoResult.lda.components.map((c) => (
                      <div className="algo-bar-row" key={c.label}>
                        <span className="algo-bar-label">{c.label}</span>
                        <span className="algo-bar-track">
                          <span className="algo-bar-fill clay" style={{ width: `${Math.min(c.ratio, 100)}%` }} />
                        </span>
                        <span className="algo-bar-value">{c.ratio.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                  {algoResult.lda.note && <p className="meta small algo-note">{algoResult.lda.note}</p>}
                </div>
              </div>

              <div className="algo-banner">
                <IconCheckCircle /> Both algorithms completed successfully — ready for analysis.
              </div>

              <div className="algo-actions">
                <button type="button" className="secondary" onClick={resetAlgorithms}>
                  <IconArrowLeft /> Back
                </button>
                <button type="button" className="proceed-btn" onClick={() => setAnalysisOpen((v) => !v)}>
                  {analysisOpen ? "Hide Analysis" : "View Analysis"} <IconArrowRight />
                </button>
              </div>

              {analysisOpen && (
                <LdaScatter
                  scatter={algoResult.lda.scatter}
                  classes={algoResult.lda.classes}
                  numericColumns={algoResult.numericColumns}
                  labelColumn={algoResult.lda.labelColumn}
                  accuracy={algoResult.lda.accuracy}
                  ld1Ratio={algoResult.lda.components[0]?.ratio}
                />
              )}
            </>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
