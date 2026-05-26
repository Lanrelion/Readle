import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, Gear, X } from '@phosphor-icons/react';
import { db } from '../services/db';
import ePub from 'epubjs';
import { useTheme } from '../hooks/useTheme';
import { PDFReader } from '../components/PDFReader';
import { syncLocalToCloud } from '../services/syncService';


export default function EbookReader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);
  
  const [readingProgress, setReadingProgress] = useState({ page: 0, total: 0, percentage: 0 });
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [pendingQuote, setPendingQuote] = useState(null);
  const [quoteColor, setQuoteColor] = useState('#F5F1E8');
  const { theme } = useTheme();

  const bookData = useLiveQuery(() => db.books.get(id), [id]);

  useEffect(() => {
    if (!bookData || !bookData.fileBlob || !viewerRef.current) return;
    
    // Bypass ePub initialization for PDF files
    const isPDF = bookData.type === 'pdf' || 
                  bookData.fileBlob?.type === 'application/pdf' || 
                  bookData.title?.toLowerCase().endsWith('.pdf');
    if (isPDF) return;

    if (bookRef.current) return; // Already initialized

    const fileReader = new FileReader();

    fileReader.onload = () => {
      if (bookRef.current) return; 

      const bookDataArrayBuffer = fileReader.result;
      const epub = ePub(bookDataArrayBuffer);
      bookRef.current = epub;

      const rendition = epub.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none',
        manager: 'continuous',
        flow: 'paginated'
      });
      renditionRef.current = rendition;

      // Update progress using chapter spine index mapping
      const updateProgress = (loc) => {
        
        let percentage = null;
        let page = 0;
        let total = parseInt(bookData.metadata?.totalPages) || 0;

        const spineItem = epub.spine.get(loc.start.cfi);
        if (spineItem && epub.spine.length > 0) {
          percentage = Math.round((spineItem.index / epub.spine.length) * 100);
          if (total > 0) {
            page = Math.max(1, Math.round((percentage / 100) * total));
          }
        }

        setReadingProgress({ page, total, percentage: percentage || 0 });

        const updateData = {
          updatedAt: new Date().toISOString(),
          synced: 0
        };
        if (bookData.status !== 'completed') {
          updateData.status = 'reading';
        }
        
        if (percentage !== null) {
          updateData.progress = { 
            type: 'percentage', 
            value: bookData.status === 'completed' ? (bookData.progress?.value || 100) : percentage, 
            cfi: loc.start.cfi 
          };
        } else {
          updateData.progress = {
            ...(bookData.progress || {}),
            cfi: loc.start.cfi
          };
        }

        db.books.update(id, updateData).then(() => {
          // Also update the dedicated ebookProgress store for syncService
          db.ebookProgress.put({
            id: `${id}-progress`,
            bookId: id,
            currentPage: page,
            totalPages: total,
            percentageRead: percentage || 0,
            lastReadDate: new Date().toISOString(),
            synced: 0
          }).then(() => {
            syncLocalToCloud().catch(err => console.warn('[Sync] Progress sync failed:', err));
          });
        });
      };

      const savedCfi = bookData.progress?.cfi || (bookData.progress?.type === 'cfi' ? bookData.progress.value : undefined);
      rendition.display(savedCfi).then(async () => {
        setIsReady(true);
        try {
          // Load quotes and apply highlights inside the reader
          const bookQuotes = await db.quotes.where('bookId').equals(id).toArray();
          bookQuotes.forEach(q => {
            if (q.cfi) {
              rendition.annotations.highlight(q.cfi, {}, () => {});
            }
          });
        } catch {
          console.warn('Could not apply highlights');
        }
      });

      rendition.on('relocated', updateProgress);
      
      rendition.on('selected', (cfiRange) => {
        epub.getRange(cfiRange).then(range => {
          if (range) {
            const text = range.toString();
            if (text && text.trim().length > 0) {
              setPendingQuote({ text: text.trim(), cfiRange });
            }
          }
        }).catch(err => console.warn('Failed to get selection range', err));
      });

      // Mobile touch selector simulator
      rendition.hooks.content.register((contents) => {
        const doc = contents.document;
        const win = contents.window;

        doc.addEventListener('touchend', () => {
          const selection = win.getSelection();
          if (selection && selection.rangeCount > 0 && selection.toString().trim().length > 0) {
            const event = new MouseEvent('mouseup', {
              view: win,
              bubbles: true,
              cancelable: true
            });
            doc.dispatchEvent(event);
          }
        });

        // Double-tap expands to sentence
        let lastTap = 0;
        doc.addEventListener('touchend', () => {
          const currentTime = new Date().getTime();
          const tapLength = currentTime - lastTap;
          if (tapLength < 500 && tapLength > 0) {
            const selection = win.getSelection();
            if (selection && !selection.isCollapsed) {
              try {
                selection.modify("move", "backward", "sentence");
                selection.modify("extend", "forward", "sentence");
                const event = new MouseEvent('mouseup', { view: win, bubbles: true, cancelable: true });
                doc.dispatchEvent(event);
              } catch (err) {
                console.warn("Sentence selection not supported", err);
              }
            }
          }
          lastTap = currentTime;
        });
        
        doc.addEventListener('dblclick', () => {
          const selection = win.getSelection();
          if (selection && !selection.isCollapsed) {
            try {
              selection.modify("move", "backward", "sentence");
              selection.modify("extend", "forward", "sentence");
              const event = new MouseEvent('mouseup', { view: win, bubbles: true, cancelable: true });
              doc.dispatchEvent(event);
            } catch {
              // Ignore selection errors on unsupported elements
            }
          }
        });
      });

      // Custom quiet editorial themes injected into epub document iframe
      rendition.themes.register('light', {
        body: { background: '#F5F1E8', color: '#1D1B18', padding: '0 24px', 'font-family': '"Noto Serif JP", serif' },
        'p, h1, h2, h3, h4, h5, h6, li, span, div': { color: '#1D1B18 !important', 'font-family': '"Noto Serif JP", serif !important', 'line-height': '1.8 !important', 'font-size': '17px !important' }
      });
      rendition.themes.register('dark', {
        body: { background: '#1A1813', color: '#F5F1E8', padding: '0 24px', 'font-family': '"Noto Serif JP", serif' },
        'p, h1, h2, h3, h4, h5, h6, li, span, div': { color: '#F5F1E8 !important', 'font-family': '"Noto Serif JP", serif !important', 'line-height': '1.8 !important', 'font-size': '17px !important' }
      });
      
      rendition.themes.select(theme);
      rendition.themes.fontSize(`${fontSize}%`);
    };
    
    fileReader.readAsArrayBuffer(bookData.fileBlob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookData?.fileBlob]);

  // Clean up ePub on unmount
  useEffect(() => {
    return () => {
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
    };
  }, []);

  // Update themes and zoom sizes reactively without tearing down the renderer
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
      renditionRef.current.themes.select(theme);
    }
  }, [fontSize, theme]);

  const next = () => renditionRef.current?.next();
  const prev = () => renditionRef.current?.prev();

  const handleZoomIn = () => setFontSize(prev => Math.min(200, prev + 10));
  const handleZoomOut = () => setFontSize(prev => Math.max(50, prev - 10));

  if (bookData === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-none border-2 border-indigo border-r-transparent"></div>
      </div>
    );
  }
  
  if (!bookData || !bookData.fileBlob) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-foreground-secondary font-serif font-normal">Book file not found or corrupted.</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2.5 bg-indigo text-background text-sm font-medium rounded-none hover:bg-clay transition duration-300">Go Back</button>
      </div>
    );
  }

  // Detect file type
  const isPDF = bookData.type === 'pdf' || 
                bookData.fileBlob?.type === 'application/pdf' || 
                bookData.title?.toLowerCase().endsWith('.pdf');

  // Render PDF reader
  if (isPDF) {
    const handleProgressUpdate = async (currentPage, totalPages, percentage) => {
      const updateData = {
        status: currentPage === totalPages ? 'completed' : 'reading',
        progress: {
          type: 'pages',
          value: `${currentPage}/${totalPages}`,
          currentPage,
          totalPages
        },
        updatedAt: new Date().toISOString(),
        synced: 0
      };
      await db.books.update(id, updateData);
      syncLocalToCloud().catch(err => console.warn('[Sync] Progress sync failed:', err));
    };

    return (
      <PDFReader
        bookId={id}
        fileBlob={bookData.fileBlob}
        onProgressUpdate={handleProgressUpdate}
      />
    );
  }


  return (
    <div className="relative h-screen w-full overflow-hidden bg-background text-foreground font-sans z-50">
      
      {/* Top Header Panel (rounded-none, border-b border-foreground-tertiary/20) */}
      <header className={`fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur border-b border-foreground-tertiary/20 flex justify-between items-center px-6 z-50 transition-transform duration-300 ${isReady ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="rounded-none p-2 hover:bg-background-secondary text-foreground-secondary hover:text-foreground transition duration-200"
            aria-label="Exit reader"
          >
            <X size={20} weight="thin" />
          </button>
          <h2 className="line-clamp-1 font-serif text-sm font-normal text-foreground">
            {bookData.title}
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowControls(!showControls)} 
            className={`rounded-none p-2 transition duration-200 ${showControls ? 'bg-background-secondary text-indigo' : 'hover:bg-background-secondary text-foreground-secondary hover:text-foreground'}`}
            aria-label="Settings"
          >
            <Gear size={20} weight="thin" />
          </button>
        </div>
      </header>

      {/* Floating Settings Tooltip Menu */}
      {showControls && (
        <div className="absolute right-6 top-20 z-50 rounded-none border border-foreground-tertiary/20 bg-background-secondary p-6 shadow-xl w-72">
          <h3 className="mb-4 text-xs font-accent text-foreground-tertiary uppercase tracking-widest border-b border-foreground-tertiary/10 pb-2">Reading Preferences</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm font-sans font-medium text-foreground">Font Zoom</span>
            <div className="flex items-center rounded-none border border-foreground-tertiary/30 bg-background overflow-hidden">
              <button onClick={handleZoomOut} className="px-3 py-1 hover:bg-background-secondary text-foreground transition-colors">-</button>
              <span className="text-xs font-medium text-foreground w-12 text-center border-x border-foreground-tertiary/20">{fontSize}%</span>
              <button onClick={handleZoomIn} className="px-3 py-1 hover:bg-background-secondary text-foreground transition-colors">+</button>
            </div>
          </div>
        </div>
      )}

      {/* Save Selection Dialogue Box */}
      {pendingQuote && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="rounded-none border border-foreground-tertiary/20 bg-background-secondary p-5 shadow-2xl backdrop-blur-md">
            <h3 className="mb-3 text-xs font-accent uppercase tracking-widest text-foreground-tertiary">Save Highlight Passage</h3>
            <div className="mb-4">
              <textarea
                value={pendingQuote.text}
                onChange={(e) => setPendingQuote({ ...pendingQuote, text: e.target.value })}
                className="w-full min-h-[90px] max-h-32 rounded-none border border-foreground-tertiary/30 bg-background px-4 py-3 text-sm font-serif italic text-foreground outline-none focus:border-indigo resize-y"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex gap-2 items-center">
                <span className="text-[10px] font-accent uppercase tracking-widest text-foreground-tertiary mr-1">Color</span>
                {['#F5F1E8', '#E3E9F1', '#E8F1E3', '#F1E3E8', '#F1EBE3'].map(color => (
                  <button
                    key={color}
                    onClick={() => setQuoteColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${quoteColor === color ? 'border-indigo scale-110 shadow-sm' : 'border-transparent hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={() => setPendingQuote(null)}
                  className="rounded-none px-4 py-2 text-xs font-sans font-medium text-foreground-tertiary hover:text-foreground"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    await db.quotes.add({
                      id: crypto.randomUUID(),
                      bookId: id,
                      text: pendingQuote.text,
                      color: quoteColor,
                      cfi: pendingQuote.cfiRange,
                      dateSaved: new Date().toISOString(),
                      synced: 0
                    });
                    
                    try {
                      renditionRef.current?.annotations.highlight(pendingQuote.cfiRange, {}, () => {});
                    } catch {
                      console.warn('Could not apply highlight');
                    }
                    
                    setPendingQuote(null);
                  }}
                  className="rounded-none bg-indigo px-5 py-2 text-xs font-sans font-medium text-background shadow-md transition hover:bg-clay"
                >
                  Save Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Rendition Area */}
      <div className="absolute inset-0 pt-16 pb-20 bg-background flex justify-center">
        <div ref={viewerRef} className="h-full w-full max-w-3xl" />
      </div>

      {/* Navigation Arrows */}
      <button 
        onClick={prev} 
        className="absolute bottom-20 left-0 top-16 z-10 w-1/4 sm:w-20 flex items-center justify-center hover:bg-foreground/5 opacity-0 sm:opacity-100 transition-opacity"
        aria-label="Previous Page"
      >
        <ArrowLeft size={32} weight="thin" className="text-foreground-tertiary hover:text-foreground transition-colors" />
      </button>
      
      <button 
        onClick={next} 
        className="absolute bottom-20 right-0 top-16 z-10 w-1/4 sm:w-20 flex items-center justify-center hover:bg-foreground/5 opacity-0 sm:opacity-100 transition-opacity"
        aria-label="Next Page"
      >
        <ArrowRight size={32} weight="thin" className="text-foreground-tertiary hover:text-foreground transition-colors" />
      </button>

      {/* Bottom Progress Controls Panel */}
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-background/95 backdrop-blur border-t border-foreground-tertiary/20 flex flex-col gap-3 p-4 z-50 justify-center">
        <div className="w-full h-1 bg-foreground-tertiary/20 rounded-full overflow-hidden">
          <div className="h-full bg-moss transition-all duration-300" style={{ width: `${readingProgress.percentage}%` }} />
        </div>
        <div className="flex justify-between items-center text-[11px] font-accent uppercase tracking-widest text-foreground-tertiary">
          <span>{readingProgress.total > 0 ? `Est. Page ${readingProgress.page} of ${readingProgress.total}` : 'Chapter Progress'}</span>
          <span>{readingProgress.percentage}%</span>
        </div>
      </div>
    </div>
  );
}
