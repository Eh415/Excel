import { useState, useRef } from "react";

type ImportNotes = {
  headerRowsSkipped: number;
  columnsRealigned: { label: string; fromCol: number; toCol: number }[];
  groupsDetected: string[];
  dividerRowsRemoved: number;
  subtotalRowsRemoved: number;
};

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
  importNotes: ImportNotes;
};

type FullDataRow = {
  index: number;
  data: Record<string, unknown>;
  missingFields: string[];
  isIncomplete: boolean;
};

type FullDataResponse = {
  columns: string[];
  rows: FullDataRow[];
  rowCount: number;
  missingByColumn: Record<string, number>;
  totalMissingCells: number;
  incompleteRowCount: number;
};

// ms since epoch -> "HH:MM:SS.mmm" in the user's local time, for Start/End Time display.
function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour12: false });
  const millis = String(d.getMilliseconds()).padStart(3, "0");
  return `${time}.${millis}`;
}

// ms duration -> "412 ms" for sub-second, or "2.34 s" once it crosses a second.
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

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

function IconDownload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v12M12 16l-5-5M12 16l5-5" />
      <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
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

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6M9 9h1" />
    </svg>
  );
}

function IconPulse() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-7 4 14 2-7h6" />
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

function SortResultChart({
  points,
  isNumeric,
  columnLabel,
  chartType,
}: {
  points: { label: string; value: number }[];
  isNumeric: boolean;
  columnLabel: string;
  chartType: "line" | "bar";
}) {
  const width = 640;
  const height = 300;
  const pad = 36;

  const values = points.map((p) => p.value);
  const minV = chartType === "bar" ? Math.min(...values, 0) : Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || 1;

  const toX = (i: number) => pad + (i / Math.max(points.length - 1, 1)) * (width - pad * 2);
  const toY = (v: number) => height - pad - ((v - minV) / span) * (height - pad * 2);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(" ");

  const barSlot = (width - pad * 2) / points.length;
  const barWidth = Math.max(barSlot * 0.7, 1);

  return (
    <div className="scatter-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="scatter-svg">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="scatter-axis" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="scatter-axis" />
        <text x={pad} y={20} className="scatter-axis-label">
          {isNumeric ? `${columnLabel} — min ${minV}, max ${maxV}` : `${columnLabel} (sorted order)`}
        </text>
        <text x={pad} y={height - pad + 16} className="scatter-axis-label">
          row 1
        </text>
        <text x={width - pad} y={height - pad + 16} textAnchor="end" className="scatter-axis-label">
          row {points.length}
        </text>
        {chartType === "line" ? (
          <>
            <path d={pathD} fill="none" stroke="#35604A" strokeWidth={2.5} />
            {points.map((p, i) => (
              <circle key={i} cx={toX(i)} cy={toY(p.value)} r={3.5} fill="#35604A">
                <title>{`Row ${i + 1}: ${p.label}`}</title>
              </circle>
            ))}
          </>
        ) : (
          points.map((p, i) => {
            const barX = pad + i * barSlot + (barSlot - barWidth) / 2;
            const y = toY(p.value);
            const baseline = toY(0);
            const barTop = Math.min(y, baseline);
            const barHeight = Math.max(Math.abs(baseline - y), 1);
            return (
              <rect
                key={i}
                x={barX}
                y={barTop}
                width={barWidth}
                height={barHeight}
                fill="#35604A"
                fillOpacity={0.85}
              >
                <title>{`Row ${i + 1}: ${p.label}`}</title>
              </rect>
            );
          })
        )}
      </svg>
    </div>
  );
}

function niceAxisMax(maxValue: number): number {
  if (maxValue <= 0) return 10;
  const rawMax = maxValue * 1.15;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const residual = rawMax / magnitude;
  let niceResidual: number;
  if (residual > 5) niceResidual = 10;
  else if (residual > 2) niceResidual = 5;
  else if (residual > 1) niceResidual = 2;
  else niceResidual = 1;
  return niceResidual * magnitude;
}

function VerticalBarChart({
  components,
  barColor,
  barColorAlt,
}: {
  components: { label: string; ratio: number }[];
  barColor: string;
  barColorAlt: string;
}) {
  const width = 300;
  const height = 200;
  const padLeft = 38;
  const padBottom = 26;
  const padTop = 14;
  const chartHeight = height - padTop - padBottom;
  const chartWidth = width - padLeft - 12;

  const maxRatio = Math.max(...components.map((c) => c.ratio), 1);
  const axisMax = niceAxisMax(maxRatio);
  const ticks = [0, axisMax / 4, axisMax / 2, (axisMax * 3) / 4, axisMax];

  const barSlot = chartWidth / components.length;
  const barWidth = barSlot * 0.55;

  const toY = (v: number) => padTop + chartHeight - (v / axisMax) * chartHeight;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={padLeft}
            x2={width - 8}
            y1={toY(t)}
            y2={toY(t)}
            stroke="#dde1d5"
            strokeDasharray="2,2"
          />
          <text x={padLeft - 6} y={toY(t) + 3} textAnchor="end" fontSize="9" fill="#5B6459" fontFamily="IBM Plex Mono, monospace">
            {Math.round(t)}%
          </text>
        </g>
      ))}
      <line x1={padLeft} x2={padLeft} y1={padTop} y2={padTop + chartHeight} stroke="#C3CBBB" />
      <line x1={padLeft} x2={width - 8} y1={padTop + chartHeight} y2={padTop + chartHeight} stroke="#C3CBBB" />
      {components.map((c, i) => {
        const barH = (c.ratio / axisMax) * chartHeight;
        const x = padLeft + i * barSlot + (barSlot - barWidth) / 2;
        const y = padTop + chartHeight - barH;
        const fill = i === 0 ? barColor : barColorAlt;
        return (
          <g key={c.label}>
            <title>{`${c.label}: ${c.ratio.toFixed(1)}%`}</title>
            <rect x={x} y={y} width={barWidth} height={Math.max(barH, 1)} rx={3} fill={fill} />
            <text x={x + barWidth / 2} y={padTop + chartHeight + 16} textAnchor="middle" fontSize="10" fill="#1C2621" fontFamily="Inter, sans-serif">
              {c.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PcaLdaDashboard({
  pcaComponents,
  ldaComponents,
  ldaAccuracy,
  ldaClasses,
}: {
  pcaComponents: AlgorithmComponent[];
  ldaComponents: AlgorithmComponent[];
  ldaAccuracy: number | null;
  ldaClasses: number;
}) {
  const pcaTotal = pcaComponents.reduce((s, c) => s + c.ratio, 0);
  const ldaTotal = ldaComponents.reduce((s, c) => s + c.ratio, 0);

  return (
    <div className="pca-lda-dashboard">
      <h3 className="pca-lda-heading">
        <IconSparkle /> PCA &amp; LDA Analysis
      </h3>

      <div className="pca-lda-stats-grid">
        <div className="pca-lda-stat">
          <span className="pca-lda-stat-label">PCA total variance</span>
          <span className="pca-lda-stat-value pine">{pcaTotal.toFixed(1)}%</span>
        </div>
        <div className="pca-lda-stat">
          <span className="pca-lda-stat-label">LDA total variance</span>
          <span className="pca-lda-stat-value clay">{ldaTotal.toFixed(1)}%</span>
        </div>
        <div className="pca-lda-stat">
          <span className="pca-lda-stat-label">LDA accuracy</span>
          <span className="pca-lda-stat-value clay">{ldaAccuracy !== null ? `${ldaAccuracy.toFixed(1)}%` : "—"}</span>
        </div>
        <div className="pca-lda-stat">
          <span className="pca-lda-stat-label">LDA classes</span>
          <span className="pca-lda-stat-value">{ldaClasses}</span>
        </div>
      </div>

      <div className="pca-lda-charts-grid">
        <div className="pca-lda-chart-card">
          <h4>PCA Explained Variance</h4>
          <VerticalBarChart components={pcaComponents} barColor="#35604A" barColorAlt="#8fb5a2" />
        </div>
        <div className="pca-lda-chart-card">
          <h4>LDA Explained Variance</h4>
          <VerticalBarChart components={ldaComponents} barColor="#C4531D" barColorAlt="#e0a578" />
        </div>
      </div>
    </div>
  );
}

type Severity = "good" | "moderate" | "attention" | "neutral";

function SeverityBadge({ severity, label }: { severity: Severity; label?: string }) {
  const text = label ?? (severity === "good" ? "Good" : severity === "moderate" ? "Moderate" : severity === "attention" ? "Needs Attention" : "—");
  return <span className={`severity-badge ${severity}`}>{text}</span>;
}

function InterpretationCard({
  icon,
  title,
  severity,
  severityLabel,
  headline,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  severity: Severity;
  severityLabel?: string;
  headline: string;
  detail: string;
}) {
  return (
    <div className="interp-card">
      <div className="interp-card-head">
        <span className="interp-icon">{icon}</span>
        <span className="interp-title">{title}</span>
        <SeverityBadge severity={severity} label={severityLabel} />
      </div>
      <p className="interp-headline">{headline}</p>
      <p className="interp-detail">{detail}</p>
    </div>
  );
}

function PcaScatter({ scores }: { scores: number[][] }) {
  const width = 560;
  const height = 300;
  const pad = 36;

  const xs = scores.map((s) => s[0]);
  const ys = scores.map((s) => s[1] ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;

  const toSvgX = (x: number) => pad + ((x - minX) / xSpan) * (width - pad * 2);
  const toSvgY = (y: number) => height - pad - ((y - minY) / ySpan) * (height - pad * 2);

  return (
    <div className="scatter-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="scatter-svg">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="scatter-axis" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="scatter-axis" />
        <text x={width / 2} y={height - 8} className="scatter-axis-label" textAnchor="middle">
          PC1
        </text>
        <text x={-height / 2} y={14} className="scatter-axis-label" textAnchor="middle" transform="rotate(-90)">
          PC2
        </text>
        {scores.map((s, i) => (
          <circle
            key={i}
            cx={toSvgX(s[0])}
            cy={toSvgY(s[1] ?? 0)}
            r={4}
            fill="#35604A"
            fillOpacity={0.65}
            stroke="#fff"
            strokeWidth={0.5}
          />
        ))}
      </svg>
    </div>
  );
}

function ComparisonTable({
  pcaTotal,
  ldaTotal,
  pc1Ratio,
  ld1Ratio,
  pcaComponentCount,
  ldaComponentCount,
}: {
  pcaTotal: number;
  ldaTotal: number;
  pc1Ratio: number;
  ld1Ratio: number;
  pcaComponentCount: number;
  ldaComponentCount: number;
}) {
  const rows: { metric: string; pca: string; lda: string; description: string }[] = [
    {
      metric: "Algorithm Type",
      pca: "Unsupervised",
      lda: "Supervised",
      description: "PCA ignores class labels; LDA uses them to maximize class separation.",
    },
    {
      metric: "Components Extracted",
      pca: String(pcaComponentCount),
      lda: String(ldaComponentCount),
      description: "Number of new axes (dimensions) produced by each algorithm.",
    },
    {
      metric: "Total Variance Explained",
      pca: `${pcaTotal.toFixed(2)}%`,
      lda: `${ldaTotal.toFixed(2)}%`,
      description: "Sum of variance captured across all retained components.",
    },
    {
      metric: "Dominant Component (1st axis)",
      pca: `${pc1Ratio.toFixed(2)}%`,
      lda: `${ld1Ratio.toFixed(2)}%`,
      description: "Variance carried by the strongest single component.",
    },
    {
      metric: "Reconstruction / PCA Accuracy",
      pca: `${pcaTotal.toFixed(2)}%`,
      lda: "—",
      description: "How much of the original data PCA can rebuild from the chosen components.",
    },
  ];

  return (
    <div className="comparison-table-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th className="pca-col">PCA</th>
            <th className="lda-col">LDA</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric}>
              <td>{r.metric}</td>
              <td className="pca-col">{r.pca}</td>
              <td className="lda-col">{r.lda}</td>
              <td className="comparison-desc">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getAnalysisData(algoResult: AlgorithmsResponse) {
  const pcaComponents = algoResult.pca.components;
  const ldaComponents = algoResult.lda.components;
  const pcaTotal = pcaComponents.reduce((s, c) => s + c.ratio, 0);
  const ldaTotal = ldaComponents.reduce((s, c) => s + c.ratio, 0);
  const pc1Ratio = pcaComponents[0]?.ratio ?? 0;
  const ld1Ratio = ldaComponents[0]?.ratio ?? 0;
  const ldaAccuracy = algoResult.lda.accuracy;

  const retentionSeverity: Severity = pcaTotal >= 80 ? "good" : pcaTotal >= 50 ? "moderate" : "attention";
  const retentionHeadline =
    retentionSeverity === "good"
      ? `PCA retains ${pcaTotal.toFixed(1)}% — strong retention.`
      : retentionSeverity === "moderate"
      ? `PCA retains ${pcaTotal.toFixed(1)}% — moderate retention, some patterns may be diluted.`
      : `PCA retains only ${pcaTotal.toFixed(1)}% — low retention detected.`;
  const retentionDetail =
    "Variance retention measures how much of the original dataset's information is preserved after dimensionality reduction. PCA transforms high-dimensional data into a smaller set of uncorrelated components ranked by the amount of variance they capture. Retention above 80% means the reduced representation closely mirrors the original data structure with minimal information loss. Between 50–80%, some patterns may be diluted — consider retaining additional components. Below 50%, the data has high intrinsic dimensionality that 2 components alone can't fully capture.";

  const reconSeverity: Severity = pcaTotal >= 80 ? "good" : pcaTotal >= 60 ? "moderate" : "attention";
  const reconHeadline =
    reconSeverity === "good"
      ? `${pcaTotal.toFixed(1)}% reconstruction accuracy — faithful summary.`
      : reconSeverity === "moderate"
      ? `${pcaTotal.toFixed(1)}% reconstruction accuracy — acceptable for exploration.`
      : `${pcaTotal.toFixed(1)}% reconstruction accuracy — significant loss.`;
  const reconDetail =
    "PCA accuracy here means reconstruction accuracy — the cumulative percentage of variance recovered when the data is rebuilt from the selected principal components. Above 80% indicates the projection is a faithful summary of the data; between 60–80% is acceptable for exploration but may hide subtle patterns; below 60% indicates the original data is too complex to represent in only 2 components.";

  const sepSeverity: Severity = ldaAccuracy === null ? "neutral" : ldaAccuracy >= 85 ? "good" : ldaAccuracy >= 70 ? "moderate" : "attention";
  const sepHeadline =
    ldaAccuracy === null
      ? "Accuracy not available — too few rows were held out to measure this reliably."
      : sepSeverity === "good"
      ? `${ldaAccuracy.toFixed(1)}% accuracy — strong class separation.`
      : sepSeverity === "moderate"
      ? `${ldaAccuracy.toFixed(1)}% accuracy — partial overlap between classes.`
      : `${ldaAccuracy.toFixed(1)}% accuracy — classes are poorly separated.`;
  const sepDetail =
    "Class separability quantifies how well LDA can distinguish between predefined classes. Unlike PCA, which is unsupervised, LDA uses class labels to find linear combinations of features that maximize the ratio of between-class variance to within-class variance. Accuracy above 85% indicates clear, well-separated clusters. Between 70–85%, there's partial overlap between classes. Below 70%, the classes are poorly separated by the features available.";

  const domSeverity: Severity = "neutral";
  const domLabel = pc1Ratio >= 50 ? "Concentrated" : "Distributed";
  const domHeadline =
    pc1Ratio >= 50
      ? `PC1 explains ${pc1Ratio.toFixed(1)}% — a single strong pattern governs the data.`
      : `PC1 explains ${pc1Ratio.toFixed(1)}% — variance is distributed across components.`;
  const domDetail =
    "Dominant component analysis examines how much variance the first principal component (PC1) captures relative to the total. When PC1 explains more than 50%, it indicates a single strong underlying pattern governs the data. When PC1 explains less than 50%, the data exhibits multidimensional complexity with several independent sources of variation contributing roughly equally.";

  return {
    pcaComponents,
    ldaComponents,
    pcaTotal,
    ldaTotal,
    pc1Ratio,
    ld1Ratio,
    ldaAccuracy,
    retentionSeverity,
    retentionHeadline,
    retentionDetail,
    reconSeverity,
    reconHeadline,
    reconDetail,
    sepSeverity,
    sepHeadline,
    sepDetail,
    domSeverity,
    domLabel,
    domHeadline,
    domDetail,
  };
}

function VisualizeAnalysisSection({ algoResult }: { algoResult: AlgorithmsResponse }) {
  const d = getAnalysisData(algoResult);

  return (
    <div className="visualize-analysis">
      <div className="va-header">
        <span className="va-header-icon">
          <IconEye />
        </span>
        <div>
          <h2 className="va-title">Visualize &amp; Analysis</h2>
          <p className="meta">2D scatter plots, variance analysis, and detailed interpretation.</p>
        </div>
      </div>

      <h3 className="va-section-heading">
        <IconSparkle /> Data Interpretation
      </h3>

      <div className="pca-lda-stats-grid va-top-stats">
        <div className="pca-lda-stat">
          <span className="pca-lda-stat-label">Datasets</span>
          <span className="pca-lda-stat-value">1</span>
        </div>
        <div className="pca-lda-stat">
          <span className="pca-lda-stat-label">PCA variance</span>
          <span className="pca-lda-stat-value pine">{d.pcaTotal.toFixed(1)}%</span>
        </div>
        <div className="pca-lda-stat">
          <span className="pca-lda-stat-label">PCA accuracy</span>
          <span className="pca-lda-stat-value pine">{d.pcaTotal.toFixed(1)}%</span>
        </div>
        <div className="pca-lda-stat">
          <span className="pca-lda-stat-label">LDA accuracy</span>
          <span className="pca-lda-stat-value clay">{d.ldaAccuracy !== null ? `${d.ldaAccuracy.toFixed(1)}%` : "—"}</span>
        </div>
      </div>

      <div className="interp-grid">
        <InterpretationCard
          icon={<IconSparkle />}
          title="Variance Retention"
          severity={d.retentionSeverity}
          headline={d.retentionHeadline}
          detail={d.retentionDetail}
        />
        <InterpretationCard
          icon={<IconTarget />}
          title="PCA Accuracy (Reconstruction)"
          severity={d.reconSeverity}
          headline={d.reconHeadline}
          detail={d.reconDetail}
        />
        <InterpretationCard
          icon={<IconTarget />}
          title="Class Separability (LDA)"
          severity={d.sepSeverity}
          headline={d.sepHeadline}
          detail={d.sepDetail}
        />
        <InterpretationCard
          icon={<IconSparkle />}
          title="Dominant Component"
          severity={d.domSeverity}
          severityLabel={d.domLabel}
          headline={d.domHeadline}
          detail={d.domDetail}
        />
      </div>

      <h3 className="va-section-heading">
        <IconEye /> Data Visualization
      </h3>

      <div className="va-viz-grid">
        <div className="va-viz-card">
          <p className="va-viz-title">
            <span className="legend-swatch" style={{ background: "#35604A" }} /> PCA — 2D Projection
          </p>
          <p className="va-viz-callout">
            The PCA 2D Projection plots each record onto the two strongest principal components (PC1 horizontal, PC2
            vertical) — the directions that capture the most variance. Points close together share similar feature
            patterns; points far apart are most different. This view reveals natural clusters, outliers, and the
            overall shape of the data <strong>without</strong> using any class labels.
          </p>
          <PcaScatter scores={algoResult.pca.scores} />
        </div>
        <div className="va-viz-card">
          <p className="va-viz-title">
            <span className="legend-swatch" style={{ background: "#7A5FA0" }} /> LDA — 2D Projection
          </p>
          <p className="va-viz-callout">
            The LDA 2D Projection plots each record onto the two strongest discriminant axes (LD1 horizontal, LD2
            vertical) — directions chosen to <strong>maximize separation between classes</strong> and minimize
            variation within each class. Tight, well-separated groups indicate the features distinguish the classes
            effectively; overlapping points indicate weak class boundaries.
          </p>
          <LdaScatter
            scatter={algoResult.lda.scatter}
            classes={algoResult.lda.classes}
            numericColumns={algoResult.numericColumns}
            labelColumn={algoResult.lda.labelColumn}
            accuracy={algoResult.lda.accuracy}
            ld1Ratio={d.ld1Ratio}
          />
        </div>
      </div>

      <PcaLdaDashboard
        pcaComponents={d.pcaComponents}
        ldaComponents={d.ldaComponents}
        ldaAccuracy={d.ldaAccuracy}
        ldaClasses={algoResult.lda.classes.length}
      />

      <h3 className="va-section-heading">Detailed Comparison Summary</h3>
      <p className="meta" style={{ marginBottom: 10 }}>
        Side-by-side comparison of every metric produced by both algorithms, including components, total variance,
        dominant axis, PCA reconstruction accuracy, and LDA class accuracy.
      </p>
      <ComparisonTable
        pcaTotal={d.pcaTotal}
        ldaTotal={d.ldaTotal}
        pc1Ratio={d.pc1Ratio}
        ld1Ratio={d.ld1Ratio}
        pcaComponentCount={d.pcaComponents.length}
        ldaComponentCount={d.ldaComponents.length}
      />
    </div>
  );
}

function ReportSection({ algoResult }: { algoResult: AlgorithmsResponse }) {
  const d = getAnalysisData(algoResult);

  return (
    <div className="visualize-analysis">
      <div className="va-header">
        <span className="va-header-icon">
          <IconDocument />
        </span>
        <div>
          <h2 className="va-title">Report</h2>
          <p className="meta">A written summary of everything found above.</p>
        </div>
      </div>

      <div className="report-text">
        <p>
          This dataset was analyzed using <strong>{algoResult.numericColumns.join(", ")}</strong> as the numeric
          features. <strong>PCA</strong> (unsupervised) retained {d.pcaTotal.toFixed(1)}% of total variance across{" "}
          {d.pcaComponents.length} components, with PC1 alone accounting for {d.pc1Ratio.toFixed(1)}% —{" "}
          {d.pc1Ratio >= 50
            ? "meaning a single dominant pattern drives most of the variation in this data."
            : "meaning variation is spread fairly evenly across multiple underlying patterns rather than one dominant axis."}
        </p>
        <p>
          <strong>LDA</strong> (supervised), using <strong>{algoResult.lda.labelColumn}</strong> as the class label
          across {algoResult.lda.classes.length} classes, achieved{" "}
          {d.ldaAccuracy !== null ? (
            <>
              {d.ldaAccuracy.toFixed(1)}% held-out classification accuracy
              {algoResult.lda.testSetSize < 5 ? " (measured on a very small held-out set, so treat this as indicative rather than definitive)" : ""}
            </>
          ) : (
            "no measurable held-out accuracy, since too few rows were available to hold out a reliable test set"
          )}
          , with LD1 capturing {d.ld1Ratio.toFixed(1)}% of the between-class separation.
        </p>
        <p>
          Overall,{" "}
          {d.retentionSeverity === "good" && d.sepSeverity === "good"
            ? "both the unsupervised structure (PCA) and the class-driven structure (LDA) are well captured in just two dimensions — this is a strong candidate for 2D visualization and downstream modeling."
            : d.retentionSeverity === "attention" && d.sepSeverity !== "attention"
            ? "while PCA alone loses a fair amount of the original variance in 2 dimensions, the class labels give LDA meaningfully more to work with — the class structure is clearer than the raw variance structure."
            : d.sepSeverity === "attention"
            ? `the classes in ${algoResult.lda.labelColumn} are not cleanly separated by ${algoResult.numericColumns.join(", ")} alone — consider whether additional or different features might better distinguish these groups.`
            : "the two methods offer complementary views: PCA shows the natural shape of the data, while LDA highlights how well the current features distinguish the chosen classes."}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [fileInfo, setFileInfo] = useState<UploadResponse | null>(null);

  const [filterColumn, setFilterColumn] = useState<string>(NONE);
  const [filterValue, setFilterValue] = useState<string>("");

  const [sortColumn, setSortColumn] = useState<string>(NONE);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [status, setStatus] = useState<"idle" | "uploading" | "sorting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [proceeded, setProceeded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  type SortPoint = { label: string; value: number };
  const [sortPreviewPoints, setSortPreviewPoints] = useState<SortPoint[] | null>(null);
  const [sortPreviewIsNumeric, setSortPreviewIsNumeric] = useState(true);
  const [sortPreviewMeta, setSortPreviewMeta] = useState<{ rowCount: number; sampled: boolean } | null>(null);
  const [sortPreviewStatus, setSortPreviewStatus] = useState<"idle" | "loading" | "error">("idle");
  const [sortPreviewError, setSortPreviewError] = useState<string>("");
  const [sortChartType, setSortChartType] = useState<"line" | "bar">("line");

  async function runSortPreview() {
    if (!fileInfo || sortColumn === NONE) return;
    setSortPreviewStatus("loading");
    setSortPreviewError("");
    try {
      const res = await fetch(`${API_BASE}/sort-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: fileInfo.fileId,
          sortColumn,
          sortOrder,
          filterColumn: filterColumn === NONE ? undefined : filterColumn,
          filterValue: filterColumn === NONE ? undefined : filterValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not build the sort graph.");
      }
      setSortPreviewPoints(data.points);
      setSortPreviewIsNumeric(data.isNumeric);
      setSortPreviewMeta({ rowCount: data.rowCount, sampled: data.sampled });
      setSortPreviewStatus("idle");
    } catch (err) {
      setSortPreviewStatus("error");
      setSortPreviewError(err instanceof Error ? err.message : "Could not build the sort graph.");
    }
  }

  function clearFilter() {
    setFilterColumn(NONE);
    setFilterValue("");
    setFilteredCount(null);
    setFilterStatus("idle");
    setFilterError("");
    setSortPreviewPoints(null);
    setSortPreviewMeta(null);
  }

  const [algoOpen, setAlgoOpen] = useState(false);
  const [labelColumn, setLabelColumn] = useState<string>(NONE);
  const [algoStatus, setAlgoStatus] = useState<"idle" | "running" | "error">("idle");
  const [algoError, setAlgoError] = useState<string>("");
  const [algoResult, setAlgoResult] = useState<AlgorithmsResponse | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"xlsx" | "pdf" | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Start/End Time + Process Duration — timed client-side around the whole upload/import
  // pipeline (network + parsing), not just server-side parse time like fileInfo.runtimeMs.
  const [processStartTime, setProcessStartTime] = useState<number | null>(null);
  const [processEndTime, setProcessEndTime] = useState<number | null>(null);

  // Full dataset preview (every uploaded record, with missing-value detection), loaded on
  // demand when the user opens the preview panel — the upload response itself only carries
  // a 5-row sample to keep that payload small.
  const [fullData, setFullData] = useState<FullDataResponse | null>(null);
  const [fullDataStatus, setFullDataStatus] = useState<"idle" | "loading" | "error">("idle");
  const [fullDataError, setFullDataError] = useState<string>("");

  async function runAlgorithmsRequest() {
    if (!fileInfo || labelColumn === NONE) return;
    setAlgoStatus("running");
    setAlgoError("");
    setAlgoResult(null);
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
    if (fileInfo && !fileInfo.columns.includes(sortColumn) && sortColumn !== NONE) {
      setSortColumn(NONE);
    }
    setAlgoResult(null);
    setDownloaded(false);
  }

  async function loadFullPreview() {
    if (!fileInfo) return;
    setFullDataStatus("loading");
    setFullDataError("");
    try {
      const res = await fetch(`${API_BASE}/full-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: fileInfo.fileId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not load the dataset preview.");
      }
      setFullData(data);
      setFullDataStatus("idle");
    } catch (err) {
      setFullDataStatus("error");
      setFullDataError(err instanceof Error ? err.message : "Could not load the dataset preview.");
    }
  }

  function togglePreview() {
    setPreviewOpen((v) => {
      const next = !v;
      if (next && !fullData && fullDataStatus !== "loading") {
        loadFullPreview();
      }
      return next;
    });
  }

  async function processFile(file: File) {
    const processStart = Date.now();
    setProcessStartTime(processStart);
    setProcessEndTime(null);
    setStatus("uploading");
    setErrorMsg("");
    setFileInfo(null);
    setProceeded(false);
    setPreviewOpen(false);
    setFullData(null);
    setFullDataStatus("idle");
    setFullDataError("");
    setFilteredCount(null);
    setFilterStatus("idle");
    setFilterError("");
    setDownloaded(false);
    setSortPreviewPoints(null);
    setSortPreviewMeta(null);
    setCurrentStep(1);
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
    } finally {
      setProcessEndTime(Date.now());
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

  async function handleExportAndDownload(format: "xlsx" | "pdf" = "xlsx") {
    if (!fileInfo) return;
    if (!algoResult) return;

    setStatus("sorting");
    setDownloadFormat(format);
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
          format,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Download failed.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match ? match[1] : format === "pdf" ? "export.pdf" : "export.xlsx";

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setStatus("idle");
      setDownloadFormat(null);
      setDownloaded(true);
    } catch (err) {
      setStatus("error");
      setDownloadFormat(null);
      setErrorMsg(err instanceof Error ? err.message : "Download failed.");
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
    setFullData(null);
    setFullDataStatus("idle");
    setFullDataError("");
    setFilteredCount(null);
    setFilterStatus("idle");
    setFilterError("");
    setSortPreviewPoints(null);
    setSortPreviewMeta(null);
    setProcessStartTime(null);
    setProcessEndTime(null);
    resetAlgorithms();
    setCurrentStep(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  type StepStatus = "done" | "active" | "upcoming";
  const steps: { n: number; label: string; icon: React.ReactNode; status: StepStatus }[] = [
    { n: 1, label: "Upload", icon: <IconUpload />, status: fileInfo ? "done" : "active" },
    {
      n: 2,
      label: "Preprocess",
      icon: <IconSettings />,
      status: !fileInfo ? "upcoming" : proceeded ? "done" : "active",
    },
    {
      n: 3,
      label: "Algorithms",
      icon: <IconPulse />,
      status: !proceeded ? "upcoming" : algoResult ? "done" : "active",
    },
    {
      n: 4,
      label: "Visualize & Analysis",
      icon: <IconEye />,
      status: !algoResult ? "upcoming" : currentStep > 4 ? "done" : "active",
    },
    {
      n: 5,
      label: "Report",
      icon: <IconDocument />,
      status: !algoResult ? "upcoming" : currentStep > 5 ? "done" : "active",
    },
    {
      n: 6,
      label: "Export",
      icon: <IconDownload />,
      status: !algoResult ? "upcoming" : downloaded ? "done" : "active",
    },
  ];

  // Steps 4-6 (Visualize & Analysis, Report, Export) are all just different views of the same
  // already-computed algoResult, so once it exists all three become freely reachable.
  const maxStepReached = !fileInfo ? 1 : !proceeded ? 2 : !algoResult ? 3 : 6;

  function goToStep(n: number) {
    if (n <= maxStepReached) setCurrentStep(n);
  }

  const progressPct = Math.round((currentStep / steps.length) * 100);

  return (
    <div className="page">
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
        <aside className="sidebar-dark" aria-label="Progress">
          <div className="sidebar-logo-row">
            <span className="sidebar-logo-badge">
              <IconPulse />
            </span>
            <div>
              <div className="sidebar-logo-title">DimReduce</div>
              <div className="sidebar-logo-subtitle">Analysis System</div>
            </div>
          </div>

          <div className="sidebar-progress-row">
            <div className="sidebar-progress-label-row">
              <span className="sidebar-progress-label">Progress</span>
              <span className="sidebar-progress-pct">{progressPct}%</span>
            </div>
            <div className="sidebar-progress-track">
              <div className="sidebar-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <ol className="sidebar-dark-steps">
            {steps.map((s) => (
              <li
                key={s.n}
                className={`sidebar-dark-step ${s.n === currentStep ? "current" : ""} ${
                  s.n <= maxStepReached ? "reachable" : ""
                } ${s.status}`}
                onClick={() => goToStep(s.n)}
                role={s.n <= maxStepReached ? "button" : undefined}
                tabIndex={s.n <= maxStepReached ? 0 : undefined}
              >
                <span className="sidebar-dark-step-icon">
                  {s.status === "done" ? <IconCheckCircle /> : s.icon}
                </span>
                <span className="sidebar-dark-step-label">{s.label}</span>
                {s.n === currentStep && (
                  <span className="sidebar-dark-step-chevron">
                    <IconArrowRight />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </aside>

        <nav className="stepper-mobile" aria-label="Progress">
          {steps.map((s) => (
            <div
              key={s.n}
              className={`step ${s.n === currentStep ? "active" : s.status === "done" ? "done" : ""} ${
                s.n <= maxStepReached ? "reachable" : ""
              }`}
              onClick={() => goToStep(s.n)}
            >
              <span className="num">{s.n}</span> {s.label}
            </div>
          ))}
        </nav>

        <div className="main-content">

      {currentStep === 1 && !fileInfo && (
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
          <p className="meta">Accepts .xlsx, .xls, and .csv — parsed entirely in memory, nothing is stored server-side</p>
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
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={status === "uploading" || status === "sorting"}
            style={{ display: "none" }}
          />
        </div>

        {status === "uploading" && <p className="status">Reading file…</p>}
        {status === "error" && <p className="status error">{errorMsg}</p>}
      </div>
      )}

      {currentStep === 1 && fileInfo && (
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
                onClick={togglePreview}
                aria-label={previewOpen ? "Hide dataset preview" : "Preview full dataset"}
                title={previewOpen ? "Hide dataset preview" : "Preview full dataset"}
              >
                <IconEye />
              </button>
              <button type="button" className="icon-btn danger" onClick={handleReset} aria-label="Remove file">
                <IconTrash />
              </button>
            </div>
          </div>

          {(fileInfo.importNotes.headerRowsSkipped > 0 ||
            fileInfo.importNotes.columnsRealigned.length > 0 ||
            fileInfo.importNotes.dividerRowsRemoved > 0 ||
            fileInfo.importNotes.subtotalRowsRemoved > 0) && (
            <div className="import-notes">
              <span className="import-notes-icon">
                <IconSparkle />
              </span>
              <div>
                <p className="import-notes-title">Smart import cleaned this file</p>
                <p className="import-notes-text">
                  {fileInfo.importNotes.headerRowsSkipped > 0 && (
                    <>Skipped {fileInfo.importNotes.headerRowsSkipped} title/header row(s) before the real data. </>
                  )}
                  {fileInfo.importNotes.columnsRealigned.length > 0 && (
                    <>
                      Corrected {fileInfo.importNotes.columnsRealigned.length} misaligned column
                      {fileInfo.importNotes.columnsRealigned.length > 1 ? "s" : ""} (
                      {fileInfo.importNotes.columnsRealigned.map((c) => c.label).join(", ")}).{" "}
                    </>
                  )}
                  {fileInfo.importNotes.dividerRowsRemoved > 0 && (
                    <>
                      Found {fileInfo.importNotes.groupsDetected.length} section
                      {fileInfo.importNotes.groupsDetected.length > 1 ? "s" : ""} and added a{" "}
                      <strong>Group</strong> column.{" "}
                    </>
                  )}
                  {fileInfo.importNotes.subtotalRowsRemoved > 0 && (
                    <>Removed {fileInfo.importNotes.subtotalRowsRemoved} subtotal/summary row(s).</>
                  )}
                </p>
              </div>
            </div>
          )}

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
                    setSortPreviewPoints(null);
                    setSortPreviewMeta(null);
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
                      setSortPreviewPoints(null);
                      setSortPreviewMeta(null);
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
            <div className="stat-card">
              <span className="stat-label">Start time</span>
              <span className="stat-value compact">{processStartTime ? formatTimestamp(processStartTime) : "—"}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">End time</span>
              <span className="stat-value compact">{processEndTime ? formatTimestamp(processEndTime) : "—"}</span>
            </div>
            <div className="stat-card highlight">
              <span className="stat-label">Process duration</span>
              <span className="stat-value compact">
                {processStartTime && processEndTime
                  ? formatDuration(processEndTime - processStartTime)
                  : "—"}
              </span>
            </div>
          </div>

          {previewOpen && (
            <div className="dataset-preview-panel" style={{ marginTop: 16 }}>
              {fullDataStatus === "loading" && <p className="status">Loading the full dataset…</p>}
              {fullDataStatus === "error" && <p className="status error">{fullDataError}</p>}

              {fullData && fullDataStatus === "idle" && (
                <>
                  <div className="missing-summary">
                    <span className="missing-summary-item">
                      <strong>{fullData.rowCount}</strong> record{fullData.rowCount === 1 ? "" : "s"} total
                    </span>
                    <span
                      className={`missing-summary-item ${fullData.incompleteRowCount > 0 ? "warn" : "ok"}`}
                    >
                      <strong>{fullData.incompleteRowCount}</strong> record
                      {fullData.incompleteRowCount === 1 ? "" : "s"} with missing values
                    </span>
                    <span
                      className={`missing-summary-item ${fullData.totalMissingCells > 0 ? "warn" : "ok"}`}
                    >
                      <strong>{fullData.totalMissingCells}</strong> missing cell
                      {fullData.totalMissingCells === 1 ? "" : "s"}
                    </span>
                  </div>

                  {fullData.totalMissingCells > 0 && (
                    <div className="missing-by-column">
                      {fullData.columns
                        .filter((col) => fullData.missingByColumn[col] > 0)
                        .map((col) => (
                          <span key={col} className="missing-chip">
                            {col}: {fullData.missingByColumn[col]} missing
                          </span>
                        ))}
                    </div>
                  )}

                  <div className="preview-wrap preview-wrap-scroll">
                    <table className="preview">
                      <thead>
                        <tr>
                          <th className="row-index-col">#</th>
                          {fullData.columns.map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fullData.rows.map((row) => (
                          <tr key={row.index} className={row.isIncomplete ? "row-incomplete" : ""}>
                            <td className="row-index-col">{row.index + 1}</td>
                            {fullData.columns.map((col) => {
                              const missing = row.missingFields.includes(col);
                              return (
                                <td key={col} className={missing ? "cell-missing" : ""}>
                                  {missing ? <span className="missing-tag">missing</span> : String(row.data[col])}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {!proceeded && (
            <div className="proceed-row">
              <button
                type="button"
                className="proceed-btn"
                onClick={() => {
                  setProceeded(true);
                  setCurrentStep(2);
                }}
              >
                Proceed to preprocessing <IconArrowRight />
              </button>
            </div>
          )}
        </div>
      )}

      {currentStep === 2 && fileInfo && proceeded && (
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
                  <select
                    value={sortColumn}
                    onChange={(e) => {
                      setSortColumn(e.target.value);
                      setSortPreviewPoints(null);
                    }}
                  >
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
                    <select
                      value={sortOrder}
                      onChange={(e) => {
                        setSortOrder(e.target.value as "asc" | "desc");
                        setSortPreviewPoints(null);
                      }}
                    >
                      <option value="asc">Ascending (A→Z, 0→9)</option>
                      <option value="desc">Descending (Z→A, 9→0)</option>
                    </select>
                  </label>
                )}
              </div>

              {sortColumn !== NONE && (
                <>
                  <div className="filter-apply-row">
                    <button
                      type="button"
                      onClick={runSortPreview}
                      disabled={sortPreviewStatus === "loading"}
                    >
                      <IconSparkle /> {sortPreviewStatus === "loading" ? "Building graph…" : "Graph the sort result"}
                    </button>
                  </div>
                  {sortPreviewStatus === "error" && <p className="status error">{sortPreviewError}</p>}
                  {sortPreviewPoints && sortPreviewPoints.length > 0 && (
                    <div className="sort-graph-panel">
                      <div className="sort-graph-head">
                        <span className="sort-graph-title">
                          <IconSparkle /> Sort Result Graph
                        </span>
                        <div className="chart-type-toggle">
                          <button
                            type="button"
                            className={`chart-type-btn ${sortChartType === "line" ? "active" : ""}`}
                            onClick={() => setSortChartType("line")}
                          >
                            Line
                          </button>
                          <button
                            type="button"
                            className={`chart-type-btn ${sortChartType === "bar" ? "active" : ""}`}
                            onClick={() => setSortChartType("bar")}
                          >
                            Bar
                          </button>
                        </div>
                      </div>
                      <SortResultChart
                        points={sortPreviewPoints}
                        isNumeric={sortPreviewIsNumeric}
                        columnLabel={sortColumn}
                        chartType={sortChartType}
                      />
                      {sortPreviewMeta?.sampled && (
                        <p className="meta small">
                          Showing 300 evenly-spaced points across all {sortPreviewMeta.rowCount} rows.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <p className="meta small preprocess-next-note">
              Next: run <strong>Apply Algorithms</strong> — download becomes available once results are ready.
            </p>

            <div className="actions">
              <button
                type="button"
                onClick={() => {
                  setAlgoOpen(true);
                  setCurrentStep(3);
                }}
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

      {currentStep === 3 && fileInfo && (
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
                    {fileInfo &&
                      Object.keys(fileInfo.uniqueValues)
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
                <button
                  type="button"
                  className="secondary small ghost"
                  onClick={() => {
                    resetAlgorithms();
                    setCurrentStep(2);
                  }}
                >
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
                <button type="button" className="secondary" onClick={() => setCurrentStep(2)}>
                  <IconArrowLeft /> Back
                </button>
                <button type="button" className="proceed-btn" onClick={() => setCurrentStep(4)}>
                  Continue to Visualize &amp; Analysis <IconArrowRight />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {currentStep === 4 && fileInfo && algoResult && (
        <div className="card algo-card">
          <VisualizeAnalysisSection algoResult={algoResult} />
          <div className="algo-actions" style={{ marginTop: 18 }}>
            <button type="button" className="secondary" onClick={() => setCurrentStep(3)}>
              <IconArrowLeft /> Back
            </button>
            <button type="button" className="proceed-btn" onClick={() => setCurrentStep(5)}>
              Continue to Report <IconArrowRight />
            </button>
          </div>
        </div>
      )}

      {currentStep === 5 && fileInfo && algoResult && (
        <div className="card algo-card">
          <ReportSection algoResult={algoResult} />
          <div className="algo-actions" style={{ marginTop: 18 }}>
            <button type="button" className="secondary" onClick={() => setCurrentStep(4)}>
              <IconArrowLeft /> Back
            </button>
            <button type="button" className="proceed-btn" onClick={() => setCurrentStep(6)}>
              Continue to Export <IconArrowRight />
            </button>
          </div>
        </div>
      )}

      {currentStep === 6 && fileInfo && algoResult && (
        <div className="card download-card">
          <div className="algo-header">
            <span className="algo-header-icon">
              <IconDownload />
            </span>
            <div>
              <h2 className="algo-title">Export</h2>
              <p className="meta">Your file is ready, with everything above applied.</p>
            </div>
          </div>

          <ul className="download-summary">
            <li>
              <span className="download-summary-key">Filter</span>
              <span className="download-summary-val">
                {filterColumn !== NONE && filterValue ? `${filterColumn} = ${filterValue}` : "None"}
              </span>
            </li>
            <li>
              <span className="download-summary-key">Sort</span>
              <span className="download-summary-val">
                {sortColumn !== NONE ? `${sortColumn}, ${sortOrder === "asc" ? "ascending" : "descending"}` : "None"}
              </span>
            </li>
          </ul>

          {status === "error" && <p className="status error">{errorMsg}</p>}

          <div className="actions">
            <button
              onClick={() => handleExportAndDownload("xlsx")}
              disabled={status === "sorting" || (filterColumn !== NONE && !filterValue)}
            >
              {status === "sorting" && downloadFormat === "xlsx"
                ? "Processing…"
                : downloaded
                ? "Download Excel Again"
                : "Download Excel"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => handleExportAndDownload("pdf")}
              disabled={status === "sorting" || (filterColumn !== NONE && !filterValue)}
            >
              <IconDownload /> {status === "sorting" && downloadFormat === "pdf" ? "Processing…" : "Download PDF"}
            </button>
            <button type="button" className="secondary" onClick={handleReset}>
              Start Over
            </button>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
