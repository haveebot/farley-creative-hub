/**
 * PDF text extraction wrapper. Uses pdf-parse (battle-tested, simple).
 *
 * Returns the extracted text + a few useful metadata bits. Caller
 * decides whether to replace existing brand_book_notes or append.
 */

import pdfParse from "pdf-parse";

export type PdfExtraction = {
  text: string;
  numPages: number;
  info: Record<string, unknown>;
};

export async function extractPdfText(buffer: Buffer): Promise<PdfExtraction> {
  const result = await pdfParse(buffer);
  return {
    text: result.text.trim(),
    numPages: result.numpages,
    info: (result.info as Record<string, unknown>) ?? {},
  };
}
