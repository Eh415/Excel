import { Matrix, EigenvalueDecomposition, inverse } from "ml-matrix";
import { PCA } from "ml-pca";

export type AlgorithmComponent = {
  label: string;
  ratio: number; // percentage, 0-100
};

export type ScatterPoint = {
  class: string;
  x: number;
  y: number;
};

export type AlgorithmsResult = {
  numericColumns: string[];
  rowsUsed: number;
  pca: {
    components: AlgorithmComponent[];
  };
  lda: {
    labelColumn: string;
    classes: string[];
    components: AlgorithmComponent[];
    accuracy: number | null; // percentage, 0-100, or null if it couldn't be evaluated
    testSetSize: number;
    note?: string;
    scatter: ScatterPoint[]; // rows projected onto LD1/LD2 (LD2 = 0 if only one component exists)
  };
};

export class AlgorithmError extends Error {}

// A column is treated as numeric only if every row has a value that parses to a finite number.
// This is intentionally conservative: a single blank or text value excludes the column, so PCA/LDA
// never silently run on partially-numeric data.
//
// Columns that look like row identifiers (e.g. "ID", "StudentID", "student_id") are excluded even
// if numeric — they're labels, not measurements, and including them distorts PCA/LDA badly since
// they're often just a sequential counter with no real variance structure.
function looksLikeIdColumn(header: string): boolean {
  const trimmed = header.trim();
  if (trimmed.toLowerCase() === "id") return true;
  if (/_id$/i.test(trimmed)) return true; // student_id, row_id
  if (trimmed.length > 2 && trimmed.slice(-2) === "ID") return true; // StudentID, RowID (camelCase)
  return false;
}

export function detectNumericColumns(
  rows: Record<string, unknown>[],
  columns: string[],
  exclude: string[] = []
): string[] {
  return columns.filter((col) => {
    if (exclude.includes(col)) return false;
    if (looksLikeIdColumn(col)) return false;
    return rows.every((row) => {
      const val = row[col];
      if (val === "" || val === null || val === undefined) return false;
      const n = Number(val);
      return Number.isFinite(n);
    });
  });
}

function toMatrix(rows: Record<string, unknown>[], numericColumns: string[]): number[][] {
  return rows.map((row) => numericColumns.map((col) => Number(row[col])));
}

function mean(rows: number[][]): number[] {
  const d = rows[0].length;
  const m = new Array(d).fill(0);
  for (const r of rows) for (let j = 0; j < d; j++) m[j] += r[j] / rows.length;
  return m;
}

function outer(a: number[], b: number[]): Matrix {
  const m = new Matrix(a.length, b.length);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) m.set(i, j, a[i] * b[j]);
  return m;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function runPCA(matrixRows: number[][]): AlgorithmComponent[] {
  const pca = new PCA(matrixRows, { center: true, scale: true });
  const variance = pca.getExplainedVariance();
  const top = variance.slice(0, Math.min(2, variance.length));
  return top.map((v, i) => ({ label: `PC${i + 1}`, ratio: v * 100 }));
}

type FittedLDA = {
  classes: string[];
  classMeans: Record<string, number[]>;
  overallMean: number[];
  components: { label: string; ratio: number; vector: number[] }[];
};

function fitLDA(trainX: number[][], trainY: string[]): FittedLDA {
  const d = trainX[0].length;
  const classes = Array.from(new Set(trainY)).sort();
  const overallMean = mean(trainX);

  let Sw = Matrix.zeros(d, d);
  let Sb = Matrix.zeros(d, d);
  const classMeans: Record<string, number[]> = {};

  for (const c of classes) {
    const classRows = trainX.filter((_, i) => trainY[i] === c);
    const cMean = mean(classRows);
    classMeans[c] = cMean;
    for (const row of classRows) {
      const diff = row.map((v, j) => v - cMean[j]);
      Sw = Sw.add(outer(diff, diff));
    }
    const diffOverall = cMean.map((v, j) => v - overallMean[j]);
    Sb = Sb.add(outer(diffOverall, diffOverall).mul(classRows.length));
  }

  // Shrinkage regularization so Sw is always invertible, even with few samples per class.
  const trace = Sw.diagonal().reduce((a, b) => a + b, 0);
  const epsilon = Math.max(1e-6, 1e-6 * (trace / d));
  Sw = Sw.add(Matrix.eye(d).mul(epsilon));

  const SwInv = inverse(Sw);
  const M = SwInv.mmul(Sb);

  const evd = new EigenvalueDecomposition(M);
  const realEig = evd.realEigenvalues;
  const eigVectors = evd.eigenvectorMatrix;

  const order = realEig.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const numComponents = Math.min(classes.length - 1, d);
  const topComponents = order.slice(0, Math.min(2, numComponents));
  const totalPositive = order.reduce((sum, o) => sum + Math.max(o.v, 0), 0) || 1;

  const components = topComponents.map((o, idx) => ({
    label: `LD${idx + 1}`,
    ratio: (Math.max(o.v, 0) / totalPositive) * 100,
    vector: eigVectors.getColumn(o.i),
  }));

  return { classes, classMeans, overallMean, components };
}

function project(row: number[], overallMean: number[], components: { vector: number[] }[]): number[] {
  const centered = row.map((v, j) => v - overallMean[j]);
  return components.map((c) => c.vector.reduce((sum, w, j) => sum + w * centered[j], 0));
}

function runLDA(matrixRows: number[][], labels: string[]) {
  const classes = Array.from(new Set(labels));
  if (classes.length < 2) {
    throw new AlgorithmError("The selected label column needs at least 2 distinct values for LDA.");
  }

  // Fit on the full dataset — this is the "official" model: its components and explained-variance
  // ratios describe the whole dataset, and we project every row through it for the scatter view.
  const fullFit = fitLDA(matrixRows, labels);
  const scatter: ScatterPoint[] = matrixRows.map((row, i) => {
    const p = project(row, fullFit.overallMean, fullFit.components);
    return { class: labels[i], x: p[0] ?? 0, y: p[1] ?? 0 };
  });

  // Separately, fit on a stratified 80/20 split so accuracy reflects generalization to unseen rows
  // rather than the optimistic in-sample number you'd get from testing on the same data it was fit on.
  const trainIdx: number[] = [];
  const testIdx: number[] = [];
  for (const c of classes) {
    const idxs = seededShuffle(
      labels.map((_, i) => i).filter((i) => labels[i] === c),
      42
    );
    const cut = Math.max(1, Math.round(idxs.length * 0.8));
    trainIdx.push(...idxs.slice(0, cut));
    testIdx.push(...idxs.slice(cut));
  }

  const trainX = trainIdx.map((i) => matrixRows[i]);
  const trainY = trainIdx.map((i) => labels[i]);
  const testX = testIdx.map((i) => matrixRows[i]);
  const testY = testIdx.map((i) => labels[i]);

  const heldOutFit = fitLDA(trainX, trainY);

  let accuracy: number | null = null;
  let note: string | undefined;

  if (testX.length === 0) {
    note = "Every class had too few rows to hold out a test set, so accuracy could not be measured.";
  } else {
    const centroidsInLDA: Record<string, number[]> = {};
    for (const c of heldOutFit.classes) {
      centroidsInLDA[c] = project(heldOutFit.classMeans[c], heldOutFit.overallMean, heldOutFit.components);
    }
    const classify = (row: number[]): string => {
      const p = project(row, heldOutFit.overallMean, heldOutFit.components);
      let best = heldOutFit.classes[0];
      let bestDist = Infinity;
      for (const c of heldOutFit.classes) {
        const dist = centroidsInLDA[c].reduce((sum, v, j) => sum + (v - p[j]) ** 2, 0);
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      return best;
    };
    let correct = 0;
    for (let i = 0; i < testX.length; i++) {
      if (classify(testX[i]) === testY[i]) correct++;
    }
    accuracy = (correct / testX.length) * 100;
    if (testX.length < 5) {
      note = `Held out only ${testX.length} row(s) for testing — accuracy is indicative, not statistically reliable.`;
    }
  }

  return {
    classes: fullFit.classes,
    components: fullFit.components.map((c) => ({ label: c.label, ratio: c.ratio })),
    accuracy,
    testSetSize: testX.length,
    note,
    scatter,
  };
}

export function runAlgorithms(
  rows: Record<string, unknown>[],
  columns: string[],
  labelColumn: string
): AlgorithmsResult {
  if (!columns.includes(labelColumn)) {
    throw new AlgorithmError(`Column "${labelColumn}" does not exist in the sheet.`);
  }

  const numericColumns = detectNumericColumns(rows, columns, [labelColumn]);
  if (numericColumns.length < 2) {
    throw new AlgorithmError(
      "Need at least 2 fully-numeric columns (besides the label column) to run PCA/LDA."
    );
  }
  if (rows.length < 4) {
    throw new AlgorithmError("Need at least 4 rows to run PCA/LDA meaningfully.");
  }

  const matrix = toMatrix(rows, numericColumns);
  const labels = rows.map((r) => String(r[labelColumn]));

  const pcaComponents = runPCA(matrix);
  const ldaResult = runLDA(matrix, labels);

  return {
    numericColumns,
    rowsUsed: rows.length,
    pca: { components: pcaComponents },
    lda: {
      labelColumn,
      classes: ldaResult.classes,
      components: ldaResult.components,
      accuracy: ldaResult.accuracy,
      testSetSize: ldaResult.testSetSize,
      note: ldaResult.note,
      scatter: ldaResult.scatter,
    },
  };
}
