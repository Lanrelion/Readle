import { useState, useEffect, useRef } from 'react';
import { loadPDF, renderPage } from '../services/pdfService';
import { savePDFProgress, loadPDFProgress } from '../services/db';
import { ArrowLeft, SlidersHorizontal } from '@phosphor-icons/react';
import { useTheme } from '../hooks/useTheme';

export function PDFReader({ bookId, fileBlob, bookTitle, onProgressUpdate }) {
  const { isDark } = useTheme();
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.5); // Zoom level
  const [showControls, setShowControls] = useState(false);
  const [logoVisible, setLogoVisible] = useState(true);
  const fadeTimerRef = useRef(null);

  // Fade logo after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setLogoVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Restore on header tap
  const handleHeaderTap = () => {
    setLogoVisible(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    // Re-fade after another 3 seconds
    fadeTimerRef.current = setTimeout(() => setLogoVisible(false), 3000);
  };
  const [contrast, setContrast] = useState(() => {
    return parseInt(localStorage.getItem('garder-pdf-contrast') || '100');
  });
  const [pdfThemeMode, setPdfThemeMode] = useState(() => {
    return localStorage.getItem('garder-pdf-theme') || 'auto';
  });

  const effectiveDarkPDF = pdfThemeMode === 'auto' ? isDark : pdfThemeMode === 'dark';

  // Persist
  useEffect(() => {
    localStorage.setItem('garder-pdf-contrast', contrast.toString());
  }, [contrast]);

  useEffect(() => {
    localStorage.setItem('garder-pdf-theme', pdfThemeMode);
  }, [pdfThemeMode]);

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
      <header
        onClick={handleHeaderTap}
        className="fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur border-b border-foreground-tertiary/20 flex items-center justify-between px-6 z-50"
      >
        {/* Logo & Back — left side */}
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.history.back();
            }}
            className="p-1.5 -ml-1.5 hover:bg-background-secondary rounded-none transition flex items-center text-foreground-secondary hover:text-foreground"
            aria-label="Close reader"
          >
            <ArrowLeft size={20} weight="thin" />
          </button>
          <img
            src="/logo.svg"
            alt="Garder"
            className={`h-5 transition-opacity duration-700 select-none cursor-pointer ${isDark ? 'invert brightness-200' : ''}`}
            style={{ opacity: logoVisible ? 1 : 0.25 }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              if (e.currentTarget.nextElementSibling) {
                e.currentTarget.nextElementSibling.style.display = 'inline';
              }
            }}
          />
          {/* Fallback if no SVG */}
          <span
            className="text-sm font-serif font-normal text-foreground-secondary transition-opacity duration-700 select-none hidden"
            style={{ opacity: logoVisible ? 1 : 0.25 }}
          >
            garder.
          </span>
        </div>

        {/* Book title — centre */}
        <span className="text-sm font-serif text-foreground truncate max-w-[50%] absolute left-1/2 -translate-x-1/2">
          {bookTitle || `Page ${currentPage} of ${numPages}`}
        </span>

        {/* Controls — right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              zoomOut();
            }}
            className="p-2 hover:bg-background-secondary rounded-none transition text-foreground"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-xs text-foreground font-sans">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              zoomIn();
            }}
            className="p-2 hover:bg-background-secondary rounded-none transition text-foreground"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Don't trigger header tap
              setShowControls(!showControls);
            }}
            className={`p-2 rounded-none transition ${showControls ? 'bg-background-secondary text-indigo' : 'hover:bg-background-secondary text-foreground-secondary hover:text-foreground'}`}
            aria-label="Reading preferences"
          >
            <SlidersHorizontal size={20} weight="thin" className={showControls ? 'text-indigo' : 'text-foreground-tertiary'} />
          </button>
        </div>
      </header>

      {/* Floating Settings Tooltip Menu */}
      {showControls && (
        <div className="fixed right-6 top-20 z-50 rounded-none border border-foreground-tertiary/20 bg-background-secondary p-6 shadow-xl w-80">
          <div className="space-y-4">
            <p className="mb-4 text-xs font-accent text-foreground-tertiary tracking-widest uppercase border-b border-foreground-tertiary/10 pb-2">
              Reading Preferences
            </p>

            {/* Page Scale / Zoom Adjustment */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-sans text-foreground">Font / Zoom Size</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={zoomOut}
                  className="w-8 h-8 border border-foreground-tertiary/30 rounded-none flex items-center justify-center text-foreground hover:bg-background transition"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <span className="text-xs text-foreground w-12 text-center font-mono">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="w-8 h-8 border border-foreground-tertiary/30 rounded-none flex items-center justify-center text-foreground hover:bg-background transition"
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            </div>

            {/* Scale Presets */}
            <div className="flex gap-1.5 justify-end">
              {[1.0, 1.25, 1.5, 2.0].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setScale(preset)}
                  className={`px-2 py-0.5 text-[11px] rounded-none border transition ${
                    Math.abs(scale - preset) < 0.05
                      ? 'bg-indigo text-white border-indigo'
                      : 'border-foreground-tertiary/30 text-foreground hover:bg-background'
                  }`}
                >
                  {Math.round(preset * 100)}%
                </button>
              ))}
            </div>

            {/* Page Reading Tone / Dark Mode */}
            <div className="flex items-center justify-between pt-1 border-t border-foreground-tertiary/10">
              <span className="text-sm font-sans text-foreground">Page Tone</span>
              <div className="flex gap-1">
                {[
                  { id: 'auto', label: 'Auto' },
                  { id: 'light', label: 'Light' },
                  { id: 'dark', label: 'Dark' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setPdfThemeMode(mode.id)}
                    className={`px-2.5 py-1 text-xs rounded-none border transition ${
                      pdfThemeMode === mode.id
                        ? 'bg-indigo text-white border-indigo'
                        : 'border-foreground-tertiary/30 text-foreground hover:bg-background'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Contrast */}
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-foreground-tertiary/10">
              <span className="text-sm font-sans text-foreground">Contrast</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setContrast(c => Math.max(c - 10, 70))}
                  className="w-8 h-8 border border-foreground-tertiary/30 rounded-none flex items-center justify-center text-foreground hover:bg-background transition"
                >
                  −
                </button>
                <span className="text-xs text-foreground w-12 text-center font-mono">{contrast}%</span>
                <button
                  onClick={() => setContrast(c => Math.min(c + 10, 130))}
                  className="w-8 h-8 border border-foreground-tertiary/30 rounded-none flex items-center justify-center text-foreground hover:bg-background transition"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Canvas */}
      <main className="pdf-reader-container flex-1 pt-20 pb-24 overflow-auto bg-background">
        {/* PDF canvas wrapper */}
        <div className="flex justify-center p-6 bg-background min-h-full">
          <canvas
            ref={canvasRef}
            style={{
              filter: effectiveDarkPDF
                ? `invert(0.92) hue-rotate(180deg) contrast(${contrast}%)`
                : `contrast(${contrast}%)`,
              display: 'block',
            }}
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
