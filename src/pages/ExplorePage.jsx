// src/pages/ExplorePage.jsx
import { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { supabase } from '../services/supabase';
import { db } from '../services/db';
import { syncLocalToCloud } from '../services/syncService';
import Navigation from '../components/Navigation';
import { Spine } from '../components/explore/Spine';
import { FaceOut } from '../components/explore/FaceOut';
import { ShelfAmbient } from '../components/explore/ShelfAmbient';
import { BookSheet } from '../components/explore/BookSheet';
import { bookArt, norm } from '../utils/bookArt';
import { gsap, ScrollTrigger } from '../utils/gsapSetup';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { buildShelves } from '../utils/buildShelves';
import { HOVER_IN_MS, HOVER_OUT_MS, SETTLE_MS } from '../components/explore/focusConfig';
import { FocusLayer } from '../components/explore/FocusLayer';
import { Link } from 'react-router-dom';

function GhostSpines({ count }) {
  return Array.from({ length: count }, (_, index) => (
    <span key={index} className="spine-slot" aria-hidden="true" style={{ cursor: 'default' }}>
      <span
        className="spine animate-pulse"
        style={{
          width: 34 + ((index * 7) % 24),
          height: `calc(var(--s) * ${150 + ((index * 13) % 60)}px)`,
          background: 'var(--color-background-tertiary)',
        }}
      />
    </span>
  ));
}

function GhostRow() {
  return (
    <div className="shelf-row" aria-hidden="true">
      <div className="shelf-scroller">
        <GhostSpines count={10} />
      </div>
    </div>
  );
}

export function ExplorePage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState(null);
  const [saved, setSaved] = useState(new Set());
  const [open, setOpen] = useState(null); // { book, rect }
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const narrow = useMediaQuery('(max-width: 639px)');
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const mode = !reduce && canHover ? 'hover' : (narrow && !reduce) ? 'scroll' : 'tap';

  const roomRef = useRef(null);
  const contentRef = useRef(null);
  const modeRef = useRef(mode);
  const focusRef = useRef(null);
  const enterTimer = useRef(null);
  const clearTimer = useRef(null);
  const [focus, setFocus] = useState(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { focusRef.current = focus; }, [focus]);

  const loadExploreBooks = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('explore_books')
        .select('*')
        .order('recommendation_count', { ascending: false })
        .order('last_recommended', { ascending: false })
        .limit(50);

      if (error) throw error;
      setFocus(null);
      setBooks((data || []).filter((book) => book.title?.trim() && book.author?.trim()));
      setIsOnline(true);
    } catch (error) {
      console.error('[Explore] Failed to load:', error);
      if (!navigator.onLine) setIsOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      loadExploreBooks();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const initialLoadTimer = window.setTimeout(() => {
      if (navigator.onLine) loadExploreBooks();
    }, 0);

    return () => {
      window.clearTimeout(initialLoadTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadExploreBooks]);

  useEffect(() => {
    db.books.toArray().then((localBooks) => {
      const keys = new Set(localBooks.map((b) => `${norm(b.title)}|${norm(b.author)}`));
      setSaved(keys);
    }).catch(err => console.warn('[Explore] Failed to load local books:', err));
  }, []);

  const openBook = useCallback((book, rect) => {
    setOpen({ book, rect });
  }, []);

  const focusNow = useCallback((book, slotEl) => {
    window.clearTimeout(enterTimer.current);
    window.clearTimeout(clearTimer.current);
    setFocus((current) => current?.book.key === book.key ? current : { book, slotEl });
  }, []);

  const clearSoon = useCallback((delay = HOVER_OUT_MS) => {
    window.clearTimeout(enterTimer.current);
    window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => setFocus(null), delay);
  }, []);

  const handleEnter = useCallback((book, slotEl) => {
    if (modeRef.current !== 'hover') return;
    window.clearTimeout(clearTimer.current);
    window.clearTimeout(enterTimer.current);
    enterTimer.current = window.setTimeout(() => focusNow(book, slotEl), HOVER_IN_MS);
  }, [focusNow]);

  const handleLeave = useCallback(() => {
    if (modeRef.current === 'hover') clearSoon();
  }, [clearSoon]);

  const holdFocus = useCallback(() => window.clearTimeout(clearTimer.current), []);

  const onActivate = useCallback((book, slotEl) => {
    const spine = slotEl.querySelector('.spine');
    if (!spine) return;
    const rect = spine.getBoundingClientRect();
    const currentMode = modeRef.current;
    if (currentMode === 'hover' || focusRef.current?.book.key === book.key) {
      openBook(book, rect);
      return;
    }
    if (currentMode === 'scroll') {
      const scroller = slotEl.closest('.shelf-scroller');
      if (!scroller) return;
      const midpoint = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
      const slotRect = slotEl.getBoundingClientRect();
      if (Math.abs(slotRect.left + slotRect.width / 2 - midpoint) < 6) {
        focusNow(book, slotEl);
        return;
      }
      slotEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      return;
    }
    focusNow(book, slotEl);
  }, [focusNow, openBook]);

  useEffect(() => () => {
    window.clearTimeout(enterTimer.current);
    window.clearTimeout(clearTimer.current);
  }, []);

  useEffect(() => {
    window.clearTimeout(enterTimer.current);
    window.clearTimeout(clearTimer.current);
    const resetTimer = window.setTimeout(() => setFocus(null), 0);
    return () => window.clearTimeout(resetTimer);
  }, [mode, narrow]);

  useEffect(() => {
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        setFocus(null);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (mode !== 'tap') return undefined;
    const onPointerDown = (event) => {
      if (!event.target.closest('.spine-slot, .focus-card, .focus-chip')) setFocus(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [mode]);

  const handleAddToLibrary = async (book) => {
    try {
      // Duplicate check by normalised title + author
      const bookKey = `${norm(book.title)}|${norm(book.author)}`;
      const existing = await db.books
        .filter((b) => `${norm(b.title)}|${norm(b.author)}` === bookKey)
        .first();

      if (!existing) {
        const newBook = {
          id: crypto.randomUUID(),
          type: 'physical',
          title: book.title,
          author: book.author,
          cover: book.cover && book.cover !== 'null' ? book.cover : null,
          tags: book.tags || [],
          status: 'wantToRead',
          recommended: false,
          recommendedAt: null,
          recommendedSyncedAt: null,
          recommendPrompted: false,
          progress: null,
          dateAdded: new Date().toISOString(),
          dateCompleted: null,
          synced: 0,
        };
        await db.books.add(newBook);

        // Sync if signed in
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          syncLocalToCloud().catch((err) => console.warn('[Explore] Sync failed:', err));
        }
      }

      // Update saved set so spine dot appears immediately
      setSaved((prev) => new Set(prev).add(bookKey));
    } catch (err) {
      console.error('[Explore] Failed to add book:', err);
    }
  };

  const { itemsByKey, visible, featured, rest, shelves, ledgeLabel } = useMemo(() => {
    const all = books.map((book) => ({
      ...book,
      key: `${norm(book.title)}|${norm(book.author)}`,
      art: bookArt(book.title, book.author),
    }));
    const filtered = activeTag ? all.filter((book) => (book.tags || []).includes(activeTag)) : all;
    const featuredBooks = filtered.slice(0, 3);
    const remainingBooks = filtered.slice(3);
    return {
      itemsByKey: new Map(all.map((book) => [book.key, book])),
      visible: filtered,
      featured: featuredBooks,
      rest: remainingBooks,
      shelves: buildShelves(remainingBooks),
      ledgeLabel: Math.max(0, ...all.map((book) => book.recommendation_count || 0)) > 1 ? 'Most recommended' : 'Newly recommended',
    };
  }, [books, activeTag]);

  // Collect all tags from explore results for filtering
  const allTags = useMemo(() => {
    return [...new Set(books.flatMap((b) => b.tags || []))].sort();
  }, [books]);

  useEffect(() => {
    if (mode !== 'scroll' || !roomRef.current) return undefined;
    const scrollers = [...roomRef.current.querySelectorAll('.shelf-scroller')];
    const timers = new Map();
    const settle = (scroller) => {
      const midpoint = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
      let nearest = null;
      let nearestDistance = Infinity;
      scroller.querySelectorAll('.spine-slot[data-key]').forEach((slot) => {
        const rect = slot.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - midpoint);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = slot;
        }
      });
      const book = nearest && itemsByKey.get(nearest.dataset.key);
      if (book) focusNow(book, nearest);
    };
    const listeners = scrollers.map((scroller) => {
      const onScroll = () => {
        setFocus((current) => current ? null : current);
        window.clearTimeout(timers.get(scroller));
        timers.set(scroller, window.setTimeout(() => settle(scroller), SETTLE_MS));
      };
      scroller.addEventListener('scroll', onScroll, { passive: true });
      return [scroller, onScroll];
    });
    const introTimer = window.setTimeout(() => scrollers[0]?.dispatchEvent(new Event('scroll')), 1300);
    return () => {
      window.clearTimeout(introTimer);
      timers.forEach((timer) => window.clearTimeout(timer));
      listeners.forEach(([scroller, handler]) => scroller.removeEventListener('scroll', handler));
    };
  }, [mode, loading, shelves, itemsByKey, focusNow]);

  // Entrance: books are placed on the shelf
  useLayoutEffect(() => {
    if (loading || reduce) return;
    const ctx = gsap.context(() => {
      if (narrow) {
        const rows = gsap.utils.toArray('.shelf-row');
        gsap.set('.shelf-row .spine-slot[data-key]', { opacity: 0, y: 40 });
        if (rows.length) {
          ScrollTrigger.batch(rows, {
            start: 'top 92%',
            once: true,
            onEnter: (enteredRows) => enteredRows.forEach((row) => {
              const slots = row.querySelectorAll('.spine-slot[data-key]');
              if (slots.length) gsap.to(slots, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.03 });
            }),
          });
        }
      } else {
        const slots = gsap.utils.toArray('.shelf-grid .spine-slot[data-key]');
        gsap.set(slots, { opacity: 0, y: 50 });
        if (slots.length) {
          ScrollTrigger.batch(slots, {
            start: 'top 95%',
            once: true,
            onEnter: (enteredSlots) => gsap.to(enteredSlots, {
              opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.035, overwrite: true,
            }),
          });
        }
      }
    }, roomRef);
    return () => ctx.revert();
  }, [loading, narrow, reduce]);

  // Tag filter: fade the shelf content out, swap books, then fade it back in.
  const selectTag = (tag) => {
    window.clearTimeout(enterTimer.current);
    window.clearTimeout(clearTimer.current);
    setFocus(null);
    if (reduce || !contentRef.current) return setActiveTag(tag);
    const content = contentRef.current;
    gsap.killTweensOf(content);
    gsap.to(content, {
      opacity: 0,
      y: 8,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        flushSync(() => setActiveTag(tag));
        gsap.fromTo(content, { opacity: 0, y: 14 }, {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power3.out',
          onComplete: () => ScrollTrigger.refresh(),
        });
      },
    });
  };

  const spineProps = (book) => ({
    book,
    saved: saved.has(book.key),
    isFocused: focus?.book.key === book.key,
    onEnter: handleEnter,
    onLeave: handleLeave,
    onKeyFocus: focusNow,
    onActivate,
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-indigo/20 lg:pl-64 pb-28 lg:pb-12">
      <Navigation />
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 lg:px-12 max-w-4xl w-full">
        {/* Header */}
        <header className="flex flex-col gap-3 py-4 sm:py-6 border-b border-foreground-tertiary/10 mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-normal text-foreground leading-tight">
            Recommended by readers
          </h1>
          <p className="text-sm text-foreground-secondary max-w-md">
            Books garder. readers finished and want to pass on. No names, just titles.
          </p>
        </header>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
            <button
              onClick={() => selectTag(null)}
              className={`
                flex-shrink-0 px-3 py-1 text-xs font-sans rounded-none border transition
                ${!activeTag
                  ? 'bg-indigo text-white border-indigo'
                  : 'border-foreground-tertiary/30 text-foreground-tertiary hover:border-foreground-tertiary'
                }
              `}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => selectTag(activeTag === tag ? null : tag)}
                className={`
                  flex-shrink-0 px-3 py-1 text-xs font-sans rounded-none border transition capitalize
                  ${activeTag === tag
                    ? 'bg-moss text-white border-moss'
                    : 'border-foreground-tertiary/30 text-foreground-tertiary hover:border-moss hover:text-moss'
                  }
                `}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* The room: recessed wall with display ledge and bookshelves */}
        <section ref={roomRef} className="shelf-room -mx-4 sm:mx-0 w-[calc(100%+2rem)] sm:w-full" data-focus={focus ? 'true' : 'false'}>
          <ShelfAmbient moteCount={narrow ? 8 : 16} reduce={reduce} />

          <div ref={contentRef} className="shelf-content">
            {featured.length > 0 && (
              <div className="ledge">
                <span className="plaque absolute left-5 top-4">{ledgeLabel}</span>
                <div className="ledge-track">
                  {featured.map((book, index) => (
                    <FaceOut key={book.key} book={book} index={index} onOpen={openBook} reduce={reduce} />
                  ))}
                </div>
              </div>
            )}
            {narrow ? (
              <div className="shelf-stack">
                {loading ? <GhostRow /> : shelves.map((shelf) => (
                  <section key={shelf.id} className="shelf-row" aria-label={shelf.label}>
                    {shelf.showLabel && <span className="plaque shelf-plaque">{shelf.label}</span>}
                    <div className="shelf-scroller">
                      {shelf.books.map((book) => <Spine key={book.key} {...spineProps(book)} />)}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="shelf-grid relative">
                {loading ? <GhostSpines count={40} /> : rest.map((book) => <Spine key={book.key} {...spineProps(book)} />)}
              </div>
            )}
          </div>

          <div className={`relative ${!loading && visible.length === 0 ? 'min-h-[240px]' : ''}`}>
            {!loading && !isOnline && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                <p className="font-serif text-lg text-foreground-secondary">
                  You're offline. Explore needs a connection. Your library still works.
                </p>
              </div>
            )}
            {!loading && isOnline && visible.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                <p className="font-serif text-lg text-foreground-secondary">No recommendations yet.</p>
                <p className="mt-2 text-sm text-foreground-secondary">Finish a book and recommend it. It will appear here.</p>
                <Link to="/" className="pointer-events-auto mt-4 inline-flex border border-foreground-tertiary/30 px-4 py-2 text-sm text-foreground hover:bg-background-secondary">
                  Go to your library
                </Link>
              </div>
            )}
          </div>
          <FocusLayer
            roomRef={roomRef}
            focus={focus}
            mode={mode}
            onOpen={openBook}
            onHold={holdFocus}
            onRelease={() => clearSoon()}
          />
        </section>
      </main>

      {open && (
        <BookSheet
          book={open.book}
          originRect={open.rect}
          saved={saved.has(open.book.key)}
          onSave={handleAddToLibrary}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

export default ExplorePage;
