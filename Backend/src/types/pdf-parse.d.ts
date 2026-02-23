declare module "pdf-parse" {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
    version: string;
  }
  function pdfParse(
    dataBuffer: Buffer,
    options?: { pagerender?: (pageData: unknown) => string; max?: number },
  ): Promise<PDFData>;
  export default pdfParse;
}
