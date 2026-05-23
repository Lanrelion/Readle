// src/components/PDFReader.jsx
import { useState, useEffect, useRef } from 'react';
import { loadPDF, renderPage } from '../services/pdfService';
import { savePDFProgress, loadPDFProgress } from '../services/db';

export function PDFReader({ bookId, fileBlob, onProgressUpdate }) {
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.5); // Zoom level
  const canvasRef = useRef(null);

  // Keep a ref to the latest progress update callback to prevent unnecessary rendering triggers
  const onProgressUpdateRef = useRef(onProgressUpdate);
  useEffect(() => {
    onProgressUpdateRef.current = onProgressUpdate;
  }, [onProgressUpdate]);

  const loadedBookIdRef = useRef(null);

  // Load PDF on mount (safely dependent on stable bookId)
  useEffect(() => {
    let mounted = true;

    async function loadPDFFile() {
      if (!fileBlob || loadedBookIdRef.current === bookId) return;
      
      try {
        setLoading(true);
        const pdfDoc = await loadPDF(fileBlob);
        
        if (mounted) {
          setPdf(pdfDoc);
          setNumPages(pdfDoc.numPages);
          setLoading(false);
          loadedBookIdRef.current = bookId; // Prevent reloading if fileBlob reference changes
        }
      } catch (error) {
        console.error('[PDFReader] Failed to load PDF:', error);
        if (mounted) setLoading(false);
      }
    }

    loadPDFFile();

    return () => {
      mounted = false;
    };
  }, [bookId, fileBlob]);

  // Load saved progress on mount when pdf and bookId are ready
  useEffect(() => {
    let mounted = true;

    async function loadSavedProgress() {
      try {
        const savedPage = await loadPDFProgress(bookId);
        if (mounted && savedPage && savedPage <= numPages) {
          setCurrentPage(savedPage);
        }
      } catch (err) {
        console.error('[PDFReader] Failed to load saved progress:', err);
      }
    }
    
    if (pdf && numPages) {
      loadSavedProgress();
    }

    return () => {
      mounted = false;
    };
  }, [pdf, bookId, numPages]);

  // Auto-save progress every 10 seconds
  useEffect(() => {
    if (!pdf || !numPages) return;

    const interval = setInterval(async () => {
      try {
        await savePDFProgress(bookId, currentPage, numPages);
      } catch (err) {
        console.error('[PDFReader] Auto-save failed:', err);
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [bookId, currentPage, numPages, pdf]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    let mounted = true;

    async function renderCurrentPage() {
      try {
        const page = await pdf.getPage(currentPage);
        
        if (mounted && canvasRef.current) {
          await renderPage(page, canvasRef.current, scale);
          
          // Update progress
          const progress = Math.round((currentPage / numPages) * 100);
          onProgressUpdateRef.current?.(currentPage, numPages, progress);
        }
      } catch (error) {
        console.error('[PDFReader] Failed to render page:', error);
      }
    }

    renderCurrentPage();

    return () => {
      mounted = false;
    };
  }, [pdf, currentPage, scale, numPages]);

  const goToNextPage = async () => {
    if (currentPage < numPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      try {
        await savePDFProgress(bookId, newPage, numPages);
      } catch (err) {
        console.error('[PDFReader] Save progress failed on next page:', err);
      }
    }
  };

  const goToPreviousPage = async () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      try {
        await savePDFProgress(bookId, newPage, numPages);
      } catch (err) {
        console.error('[PDFReader] Save progress failed on prev page:', err);
      }
    }
  };

  const goToPage = async (pageNum) => {
    const page = Math.max(1, Math.min(pageNum, numPages));
    setCurrentPage(page);
    try {
      await savePDFProgress(bookId, page, numPages);
    } catch (err) {
      console.error('[PDFReader] Save progress failed on go to page:', err);
    }
  };

  const zoomIn = () => setScale(Math.min(scale + 0.25, 3.0));
  const zoomOut = () => setScale(Math.max(scale - 0.25, 0.5));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo mx-auto mb-4"></div>
          <p className="text-foreground-secondary">Loading PDF...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur border-b border-foreground-tertiary/20 flex justify-between items-center px-6 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-background-secondary rounded-none transition"
            aria-label="Close reader"
          >
            ← Back
          </button>
          <span className="text-sm font-serif text-foreground">
            Page {currentPage} of {numPages}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-2 hover:bg-background-secondary rounded-none transition"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-xs text-foreground-tertiary">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-2 hover:bg-background-secondary rounded-none transition"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </header>

      {/* PDF Canvas */}
      <main className="flex-1 pt-20 pb-24 overflow-auto">
        <div className="flex justify-center p-6">
          <canvas
            ref={canvasRef}
            className="shadow-lg border border-foreground-tertiary/10"
          />
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="fixed bottom-0 left-0 right-0 h-20 bg-background/95 backdrop-blur border-t border-foreground-tertiary/20 flex flex-col gap-3 p-4">
        {/* Progress bar */}
        <div className="w-full h-1 bg-foreground-tertiary/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-moss transition-all duration-300"
            style={{ width: `${(currentPage / numPages) * 100}%` }}
          />
        </div>
        
        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-indigo text-white rounded-none disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-clay"
            aria-label="Previous page"
          >
            ← Previous
          </button>
          
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max={numPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 text-center border border-foreground-tertiary/30 rounded-none bg-background text-foreground"
            />
            <span className="text-xs text-foreground-tertiary">/ {numPages}</span>
          </div>
          
          <button
            onClick={goToNextPage}
            disabled={currentPage === numPages}
            className="px-4 py-2 bg-indigo text-white rounded-none disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-clay"
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      </footer>
    </div>
  );
}
