import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { db } from '../services/db';
import ePub from 'epubjs';
import { useTheme } from '../hooks/useTheme';

export default function EbookReader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);
  
  const [location, setLocation] = useState(null);
  const [readingProgress, setReadingProgress] = useState({ page: 0, total: 0, percentage: 0 });
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [pendingQuote, setPendingQuote] = useState(null);
  const [quoteColor, setQuoteColor] = useState('#F7F3ED');
  const { theme } = useTheme();

  const bookData = useLiveQuery(() => db.books.get(id), [id]);

  useEffect(() => {
    if (!bookData || !bookData.fileBlob || !viewerRef.current) return;
    if (bookRef.current) return; // Already initialized

    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      // Prevent strict-mode race conditions
      if (bookRef.current) return; 

      const bookDataArrayBuffer = e.target.result;
      
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

      renditionRef.current = rendition;

      // Update progress instantly using spine (chapter) mapping instead of heavy location generation
      const updateProgress = (loc) => {
        setLocation(loc);
        
        let percentage = null;
        let page = 0;
        let total = parseInt(bookData.metadata?.totalPages) || 0;

        // Instant rough calculation based on current chapter
        const spineItem = epub.spine.get(loc.start.cfi);
        if (spineItem && epub.spine.length > 0) {
          // Calculate percentage based on chapter progress
          percentage = Math.round((spineItem.index / epub.spine.length) * 100);
          
          // Estimate page if totalPages was manually provided
          if (total > 0) {
            page = Math.max(1, Math.round((percentage / 100) * total));
          }
        }

        setReadingProgress({ page, total, percentage: percentage || 0 });

        const updateData = {};
        
        // Don't revert completed status to reading
        if (bookData.status !== 'completed') {
          updateData.status = 'reading';
        }
        
        if (percentage !== null) {
          updateData.progress = { 
            type: 'percentage', 
            // If the book is completed, preserve its 100% progress value
            value: bookData.status === 'completed' ? (bookData.progress?.value || 100) : percentage, 
            cfi: loc.start.cfi 
          };
        } else {
          updateData.progress = {
            ...(bookData.progress || {}),
            cfi: loc.start.cfi
          };
        }

        db.books.update(id, updateData);
      };

      const savedCfi = bookData.progress?.cfi || (bookData.progress?.type === 'cfi' ? bookData.progress.value : undefined);
      rendition.display(savedCfi).then(async () => {
        setIsReady(true);
        try {
          // Load existing quotes and apply highlights
          const bookQuotes = await db.quotes.where('bookId').equals(id).toArray();
          bookQuotes.forEach(q => {
            if (q.cfi) {
              rendition.annotations.highlight(q.cfi, {}, (e) => {});
            }
          });
        } catch (e) {
          console.warn('Could not apply highlights', e);
        }
      });

      rendition.on('relocated', updateProgress);
      
      // Handle text selection for saving quotes (epub.js only binds to mouseup, so we fix mobile)
      rendition.on('selected', (cfiRange, contents) => {
        epub.getRange(cfiRange).then(range => {
          if (range) {
            const text = range.toString();
            if (text && text.trim().length > 0) {
              setPendingQuote({ text: text.trim(), cfiRange });
            }
          }
        }).catch(err => console.warn('Failed to get selection range', err));
      });

      // Fix mobile selection by simulating mouseup on touchend
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

        // Double-tap to select sentence
        let lastTap = 0;
        doc.addEventListener('touchend', (e) => {
          const currentTime = new Date().getTime();
          const tapLength = currentTime - lastTap;
          if (tapLength < 500 && tapLength > 0) {
            // Double tap detected
            const selection = win.getSelection();
            if (selection && !selection.isCollapsed) {
              try {
                // Try to use browser's native sentence expansion
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
            } catch (err) {}
          }
        });
      });

      // Register themes for proper contrast and typography
      rendition.themes.register('light', {
        body: { background: '#F7F3ED', color: '#1F1A17', padding: '0 20px', 'font-family': '"Noto Serif JP", serif' },
        'p, h1, h2, h3, h4, h5, h6, li, span, div': { color: '#1F1A17 !important', 'font-family': '"Noto Serif JP", serif !important', 'line-height': '1.8 !important' }
      });
      rendition.themes.register('dark', {
        body: { background: '#1F1A17', color: '#F7F3ED', padding: '0 20px', 'font-family': '"Noto Serif JP", serif' },
        'p, h1, h2, h3, h4, h5, h6, li, span, div': { color: '#F7F3ED !important', 'font-family': '"Noto Serif JP", serif !important', 'line-height': '1.8 !important' }
      });
      
      rendition.themes.select(theme);
      rendition.themes.fontSize(`${fontSize}%`);
    };
    
    fileReader.readAsArrayBuffer(bookData.fileBlob);
  }, [bookData?.fileBlob]); // Only depend on fileBlob reference

  // Handle cleanup only on unmount
  useEffect(() => {
    return () => {
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
    };
  }, []);

  // Handle font size and theme changes without destroying the book
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
      renditionRef.current.themes.select(theme);
    }
  }, [fontSize, theme]);

  const next = () => renditionRef.current?.next();
  const prev = () => renditionRef.current?.prev();

  const handleZoomIn = () => {
    const newSize = Math.min(200, fontSize + 10);
    setFontSize(newSize);
    renditionRef.current?.themes.fontSize(`${newSize}%`);
  };

  const handleZoomOut = () => {
    const newSize = Math.max(50, fontSize - 10);
    setFontSize(newSize);
    renditionRef.current?.themes.fontSize(`${newSize}%`);
  };

  if (bookData === undefined) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
    </div>
  );
  
  if (!bookData || !bookData.fileBlob) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <p className="text-muted-foreground font-medium">Book file not found or corrupted.</p>
      <button onClick={() => navigate(-1)} className="inline-flex items-center justify-center rounded-full bg-[#3B4A6B] px-[20px] py-[14px] text-[14px] font-medium text-[#FAF8F4] shadow-sm transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">Go Back</button>
    </div>
  );

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      <div className={`absolute left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur-md transition-transform duration-300 ${isReady ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="rounded-full p-2.5 hover:bg-muted/50 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="line-clamp-1 font-serif text-base font-semibold">{bookData.title}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setShowControls(!showControls)} className={`rounded-full p-2.5 transition-colors ${showControls ? 'bg-muted text-foreground' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'}`}>
            <Settings size={20} />
          </button>
        </div>
      </div>

      {showControls && (
        <div className="absolute right-6 top-20 z-50 rounded-3xl border border-border/60 bg-card p-6 shadow-sm w-72">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Reading Settings</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Font Size</span>
            <div className="flex items-center rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
              <button onClick={handleZoomOut} className="px-4 py-2 hover:bg-muted/50 text-foreground transition-colors">-</button>
              <span className="text-sm font-medium text-foreground w-12 text-center border-x border-border/30">{fontSize}%</span>
              <button onClick={handleZoomIn} className="px-4 py-2 hover:bg-muted/50 text-foreground transition-colors">+</button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Quote Modal */}
      {pendingQuote && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="rounded-[20px] border border-border/60 bg-card p-5 shadow-2xl backdrop-blur-md">
            <h3 className="mb-3 text-sm font-medium">Save Selected Text</h3>
            <div className="mb-4">
              <textarea
                value={pendingQuote.text}
                onChange={(e) => setPendingQuote({ ...pendingQuote, text: e.target.value })}
                className="w-full min-h-[90px] max-h-32 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-serif italic text-foreground outline-none focus:border-primary/50 resize-y"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex gap-2 items-center">
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mr-1">Color</span>
                {['#F7F3ED', '#E3E9F1', '#E8F1E3', '#F1E3E8', '#F1EBE3'].map(color => (
                  <button
                    key={color}
                    onClick={() => setQuoteColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${quoteColor === color ? 'border-primary scale-110 shadow-sm' : 'border-transparent hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPendingQuote(null)}
                  className="rounded-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
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
                      dateSaved: new Date().toISOString()
                    });
                    
                    try {
                      renditionRef.current?.annotations.highlight(pendingQuote.cfiRange, {}, (e) => {});
                    } catch(e) {
                      console.warn('Could not apply highlight', e);
                    }
                    
                    setPendingQuote(null);
                  }}
                  className="rounded-full bg-[#3B4A6B] px-5 py-2 text-xs font-medium text-[#FAF8F4] shadow-sm transition-transform hover:-translate-y-0.5 active:scale-95"
                >
                  Save Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 pt-16 pb-14 bg-background flex justify-center">
        <div ref={viewerRef} className="h-full w-full max-w-3xl" />
      </div>

      <button 
        onClick={prev} 
        className="absolute bottom-14 left-0 top-16 z-10 w-1/4 sm:w-20 flex items-center justify-center hover:bg-foreground/5 opacity-0 sm:opacity-100 transition-opacity"
      >
        <ChevronLeft size={36} className="text-muted-foreground/50 hover:text-foreground/70" />
      </button>
      
      <button 
        onClick={next} 
        className="absolute bottom-14 right-0 top-16 z-10 w-1/4 sm:w-20 flex items-center justify-center hover:bg-foreground/5 opacity-0 sm:opacity-100 transition-opacity"
      >
        <ChevronRight size={36} className="text-muted-foreground/50 hover:text-foreground/70" />
      </button>

      <div className="absolute bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/80 backdrop-blur-md px-6 py-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        <span>{readingProgress.total > 0 ? `Est. Page ${readingProgress.page} of ${readingProgress.total}` : 'Chapter Progress'}</span>
        <span>{readingProgress.percentage}%</span>
      </div>
    </div>
  );
}
