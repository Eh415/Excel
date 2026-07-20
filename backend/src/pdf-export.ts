import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake";

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const COLOR_INK = "#1C2621";
const COLOR_INK_SOFT = "#5B6459";
const COLOR_RULE = "#C3CBBB";
const COLOR_PAPER = "#EDEFE7";
const COLOR_STRIPE = "#F6F7F3";

export type PdfExportMeta = {
  fileName: string;
  rowCount: number;
  filterDescription?: string;
  sortDescription?: string;
};

export function generatePdf(
  columns: string[],
  rows: Record<string, unknown>[],
  meta: PdfExportMeta
): Promise<Buffer> {
  const printer = new PdfPrinter(fonts);

  // Wide tables get cramped fast — scale font size down a bit as column count grows.
  const bodyFontSize = columns.length > 15 ? 6.5 : columns.length > 10 ? 7.5 : 8.5;
  const headerFontSize = bodyFontSize + 0.5;

  const subtitleParts: string[] = [];
  if (meta.filterDescription) subtitleParts.push(`Filter: ${meta.filterDescription}`);
  if (meta.sortDescription) subtitleParts.push(`Sort: ${meta.sortDescription}`);
  subtitleParts.push(`${meta.rowCount} row${meta.rowCount === 1 ? "" : "s"}`);

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: columns.length > 6 ? "landscape" : "portrait",
    pageMargins: [24, 50, 24, 36],
    defaultStyle: { font: "Helvetica", fontSize: bodyFontSize, color: COLOR_INK },
    header: {
      margin: [24, 16, 24, 0],
      columns: [
        { text: "Excel Sorter", fontSize: 9, bold: true, color: COLOR_INK },
        { text: new Date().toLocaleString(), fontSize: 8, color: COLOR_INK_SOFT, alignment: "right" },
      ],
    },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [24, 0, 24, 16],
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: COLOR_INK_SOFT,
    }),
    content: [
      { text: meta.fileName, fontSize: 14, bold: true, color: COLOR_INK, margin: [0, 0, 0, 2] },
      { text: subtitleParts.join("  ·  "), fontSize: 9, color: COLOR_INK_SOFT, margin: [0, 0, 0, 12] },
      {
        table: {
          headerRows: 1,
          widths: Array(columns.length).fill("*"),
          body: [
            columns.map((c) => ({
              text: c,
              fontSize: headerFontSize,
              bold: true,
              color: COLOR_INK,
              fillColor: COLOR_PAPER,
              margin: [3, 3, 3, 3],
            })),
            ...rows.map((row, i) =>
              columns.map((c) => ({
                text: row[c] === null || row[c] === undefined ? "" : String(row[c]),
                fontSize: bodyFontSize,
                color: COLOR_INK,
                fillColor: i % 2 === 1 ? COLOR_STRIPE : undefined,
                margin: [3, 2, 3, 2],
              }))
            ),
          ],
        },
        layout: {
          hLineColor: () => COLOR_RULE,
          vLineColor: () => COLOR_RULE,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
      },
    ],
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", reject);
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}
