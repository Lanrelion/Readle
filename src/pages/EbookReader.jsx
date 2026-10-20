import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, X, SlidersHorizontal } from '@phosphor-icons/react';
import { db } from '../services/db';
import ePub from 'epubjs';
import { useTheme } from '../hooks/useTheme';
import { PDFReader } from '../components/PDFReader';
import { syncLocalToCloud } from '../services/syncService';



function applyEpubThemeStyles(doc, isDark, fontMode) {
  if (!doc) return;
  let styleEl = doc.getElementById('garder-reader-theme-styles');
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'garder-reader-theme-styles';
    doc.head.appendChild(styleEl);
  }

  const bgColor = isDark ? '#151413' : '#F5F1E8';
  const textColor = isDark ? '#EDE8DF' : '#1D1B18';
  const headingColor = isDark ? '#F7F3EB' : '#1D1B18';
  const secondaryColor = isDark ? '#A39E93' : '#6E6B65';
  const linkColor = isDark ? '#9CAFB7' : '#5C4A3A';

  let fontRules = '';
  if (fontMode === 'garder') {
    fontRules = 'font-family: "Lora", "Georgia", serif !important;';
  } else if (fontMode === 'sans') {
    fontRules = 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;';
  }

  styleEl.textContent = `
    html, body {
      background-color: ${bgColor} !important;
      color: ${textColor} !important;
      margin: 0 !important;
      width: 100% !important;
      max-width: none !important;
      box-sizing: border-box !important;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
    }
    body {
      ${fontRules}
      line-height: 1.8 !important;
      padding: 0 32px !important;
      -webkit-font-smoothing: antialiased;
      overflow-wrap: break-word !important;
    }
    p, span, div, li, blockquote, dd, dt, article, section, em, strong, i, b {
      color: ${textColor} !important;
      background-color: transparent !important;
      ${fontRules}
    }
    p {
      margin-bottom: 1.25em !important;
      text-align: left !important;
    }
    h1, h2, h3, h4, h5, h6 {
      color: ${headingColor} !important;
      ${fontMode === 'garder' ? 'font-family: "Cormorant Garamond", serif !important; font-weight: 500 !important;' : fontRules}
    }
    small, .footnote, figcaption {
      color: ${secondaryColor} !important;
    }
    a {
      color: ${linkColor} !important;
    }
    img, svg, video {
      max-width: 100% !important;
      height: auto !important;
    }
  `;
}

export default function EbookReader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);
  
  const [readingProgress, setReadingProgress] = useState({ page: 0, total: 0, percentage: 0 });
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [fontZoom, setFontZoom] = useState(() => {
    const saved = localStorage.getItem('readle-font-zoom') || localStorage.getItem('garder-epub-zoom');
    return saved ? parseInt(saved, 10) : 100;
  });
  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem('garder-epub-font-family') || (localStorage.getItem('garder-epub-font') === 'original' ? 'original' : 'garder');
  });
  const [readerThemeMode, setReaderThemeMode] = useState(() => {
    return localStorage.getItem('garder-epub-theme') || 'auto';
  });
  const [pendingQuote, setPendingQuote] = useState(null);
  const [quoteColor, setQuoteColor] = useState('#F5F1E8');
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

  const { isDark } = useTheme();
  const effectiveDarkEpub = readerThemeMode === 'auto' ? isDark : readerThemeMode === 'dark';

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

        try {
          const fontLink = doc.createElement('link');
          fontLink.rel = 'stylesheet';
          fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap';
          doc.head.appendChild(fontLink);
        } catch {
          // Ignore if document head is unavailable
        }

        // Apply initial theme styles into iframe
        applyEpubThemeStyles(doc, effectiveDarkEpub, fontFamily);
      });

      // Register a minimal theme just for epubjs internals, actual styling is via injected <style>
      rendition.themes.register('garder', {
        'html': {
          'margin': '0',
          'width': '100%',
          'max-width': 'none',
          'box-sizing': 'border-box',
        },
        'body': {
          'width': '100%',
          'max-width': 'none',
          'margin': '0',
          'padding': '0 32px',
          'box-sizing': 'border-box',
        }
      });

      rendition.themes.select('garder');
      rendition.themes.fontSize(`${fontZoom}%`);
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

  // Save zoom when changed
  useEffect(() => {
    localStorage.setItem('readle-font-zoom', fontZoom.toString());
  }, [fontZoom]);

  // Persist font family preference
  useEffect(() => {
    localStorage.setItem('garder-epub-font-family', fontFamily);
  }, [fontFamily]);

  // Persist reader theme mode
  useEffect(() => {
    localStorage.setItem('garder-epub-theme', readerThemeMode);
  }, [readerThemeMode]);

  // When font zoom state changes, re-apply font size to the theme
  useEffect(() => {
    if (!renditionRef.current) return;
    renditionRef.current.themes.fontSize(`${fontZoom}%`);
  }, [fontZoom]);

  // Re-apply theme styles when dark mode, font family, or reader theme mode changes
  useEffect(() => {
    if (!renditionRef.current) return;
    const contents = renditionRef.current.getContents();
    if (contents && contents.length > 0) {
      contents.forEach(c => {
        if (c.document) {
          applyEpubThemeStyles(c.document, effectiveDarkEpub, fontFamily);
        }
      });
    }
  }, [effectiveDarkEpub, fontFamily]);

  // Add touch swipe support
  useEffect(() => {
    if (!isReady || !renditionRef.current) return;

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowRight') renditionRef.current?.next();
      if (e.key === 'ArrowLeft') renditionRef.current?.prev();
    };

    let touchStartX = 0;

    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) { // Minimum swipe distance
        if (diff > 0) {
          renditionRef.current?.next(); // Swipe left = next page
        } else {
          renditionRef.current?.prev(); // Swipe right = prev page
        }
      }
    };

    document.addEventListener('keyup', handleKeyUp);
    
    // Add touch listener to the viewer element
    const viewer = viewerRef.current;
    if (viewer) {
      viewer.addEventListener('touchstart', handleTouchStart, { passive: true });
      viewer.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      document.removeEventListener('keyup', handleKeyUp);
      if (viewer) {
        viewer.removeEventListener('touchstart', handleTouchStart);
        viewer.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [isReady]);

  const next = () => renditionRef.current?.next();
  const prev = () => renditionRef.current?.prev();

  const handleZoomIn = () => setFontZoom(prev => Math.min(200, prev + 10));
  const handleZoomOut = () => setFontZoom(prev => Math.max(50, prev - 10));

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
    const handleProgressUpdate = async (currentPage, totalPages) => {
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
        bookTitle={bookData.title}
        onProgressUpdate={handleProgressUpdate}
      />
    );
  }


  return (
    <div className="fixed inset-0 bg-background flex flex-col text-foreground font-sans z-50">
      
      {/* Top Header Panel */}
      <header 
        onClick={handleHeaderTap}
        className={`sticky top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur border-b border-foreground-tertiary/20 flex items-center justify-between px-6 z-50 flex-shrink-0 transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Logo & Exit — left side */}
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigate(-1);
            }} 
            className="rounded-none p-1.5 -ml-1.5 hover:bg-background-secondary text-foreground-secondary hover:text-foreground transition duration-200"
            aria-label="Exit reader"
          >
            <X size={20} weight="thin" />
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
          {bookData.title}
        </span>
        
        {/* Controls — right side */}
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation(); // Don't trigger header tap
              setShowControls(!showControls);
            }} 
            className={`p-2 rounded-none transition duration-200 ${showControls ? 'bg-background-secondary text-indigo' : 'hover:bg-background-secondary text-foreground-secondary hover:text-foreground'}`}
            aria-label="Reading preferences"
          >
            <SlidersHorizontal size={20} weight="thin" className={showControls ? 'text-indigo' : 'text-foreground-tertiary'} />
          </button>
        </div>
      </header>

      {/* Floating Settings Tooltip Menu */}
      {showControls && (
        <div className="absolute right-6 top-20 z-50 rounded-none border border-foreground-tertiary/20 bg-background-secondary p-6 shadow-xl w-80">
          <div className="space-y-4">
            <p className="mb-4 text-xs font-accent text-foreground-tertiary tracking-widest uppercase border-b border-foreground-tertiary/10 pb-2">
              Reading Preferences
            </p>

            {/* Font Family */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-sans text-foreground">Font</span>
              <div className="flex gap-1">
                {[
                  { id: 'garder', label: 'Serif' },
                  { id: 'sans', label: 'Sans' },
                  { id: 'original', label: 'Original' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setFontFamily(opt.id)}
                    className={`px-2.5 py-1 text-xs rounded-none border transition ${
                      fontFamily === opt.id
                        ? 'bg-indigo text-white border-indigo'
                        : 'border-foreground-tertiary/30 text-foreground hover:bg-background'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Font Zoom */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-sans text-foreground">Font Size</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleZoomOut}
                  className="w-8 h-8 flex items-center justify-center border border-foreground-tertiary/30 bg-background rounded-none hover:bg-background-secondary transition text-foreground"
                >
                  −
                </button>
                <span className="text-sm font-mono text-foreground w-12 text-center">
                  {fontZoom}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="w-8 h-8 flex items-center justify-center border border-foreground-tertiary/30 bg-background rounded-none hover:bg-background-secondary transition text-foreground"
                >
                  +
                </button>
              </div>
            </div>

            {/* Font Size Presets */}
            <div className="flex gap-1.5 justify-end">
              {[80, 100, 120, 150].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setFontZoom(preset)}
                  className={`px-2 py-0.5 text-[11px] rounded-none border transition ${
                    fontZoom === preset
                      ? 'bg-indigo text-white border-indigo'
                      : 'border-foreground-tertiary/30 text-foreground hover:bg-background'
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>

            {/* Page Tone */}
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
                    onClick={() => setReaderThemeMode(mode.id)}
                    className={`px-2.5 py-1 text-xs rounded-none border transition ${
                      readerThemeMode === mode.id
                        ? 'bg-indigo text-white border-indigo'
                        : 'border-foreground-tertiary/30 text-foreground hover:bg-background'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
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
                  className="rounded-none bg-indigo px-5 py-2 text-xs font-sans font-medium text-white shadow-md transition hover:bg-clay"
                >
                  Save Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Rendition Area */}
      <div 
        className="epub-reader-container flex-1 w-full flex justify-center overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: effectiveDarkEpub ? '#151413' : '#F5F1E8' }}
      >
        <div 
          ref={viewerRef} 
          className="w-full max-w-3xl" 
          style={{ 
            height: 'calc(100dvh - 144px)', // header(64px) + footer(80px)
            overflow: 'hidden' 
          }} 
        />
      </div>

      {/* Navigation Arrows */}
      <button 
        onClick={prev} 
        className="absolute bottom-20 left-0 top-16 z-10 w-1/4 sm:w-20 flex items-center justify-center hover:bg-foreground/5 opacity-0 sm:opacity-100 transition-opacity" style={{ top: '64px' }}
        aria-label="Previous Page"
      >
        <ArrowLeft size={32} weight="thin" className="text-foreground-tertiary hover:text-foreground transition-colors" />
      </button>
      
      <button 
        onClick={next} 
        className="absolute bottom-20 right-0 top-16 z-10 w-1/4 sm:w-20 flex items-center justify-center hover:bg-foreground/5 opacity-0 sm:opacity-100 transition-opacity" style={{ top: '64px' }}
        aria-label="Next Page"
      >
        <ArrowRight size={32} weight="thin" className="text-foreground-tertiary hover:text-foreground transition-colors" />
      </button>

      {/* Bottom Progress Controls Panel */}
      <div className="h-20 flex-shrink-0 bg-background/95 backdrop-blur border-t border-foreground-tertiary/20 flex flex-col gap-3 p-4 z-50 justify-center">
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
