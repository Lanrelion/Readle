// src/services/pdfService.js
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

/**
 * Load PDF from blob
 * @param {Blob} blob - PDF file blob
 * @returns {Promise<PDFDocumentProxy>}
 */
export async function loadPDF(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return loadingTask.promise;
}

/**
 * Render PDF page to canvas
 * @param {PDFPageProxy} page - PDF page
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {number} scale - Zoom scale (1.0 = 100%)
 */
export async function renderPage(page, canvas, scale = 1.5) {
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };
  
  await page.render(renderContext).promise;
}

/**
 * Get PDF metadata
 * @param {PDFDocumentProxy} pdf
 * @returns {Promise<Object>}
 */
export async function getPDFMetadata(pdf) {
  const metadata = await pdf.getMetadata();
  return {
    title: metadata.info?.Title || 'Untitled PDF',
    author: metadata.info?.Author || 'Unknown',
    numPages: pdf.numPages,
  };
}
