// src/components/explore/BookSheet.jsx
import { useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { gsap, prefersReducedMotion } from '../../utils/gsapSetup';
import { CoverFace } from './CoverFace';

export function BookSheet({ book, originRect, saved, onSave, onClose }) {
  const root = useRef(null);
  const backdrop = useRef(null);
  const cover = useRef(null);
  const tlRef = useRef(null);
  const closeBtn = useRef(null);
  const closeStarted = useRef(false);

  // Dismiss immediately so the close control never depends on animation progress.
  const close = useCallback(() => {
    if (closeStarted.current) return;
    closeStarted.current = true;
    tlRef.current?.kill();
    onClose();
  }, [onClose]);

  // Keyboard: Escape closes
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);

  // Animation on mount
  useLayoutEffect(() => {
    document.body.style.overflow = 'hidden';

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      tlRef.current = tl;

      // Backdrop fade-in
      tl.fromTo(
        backdrop.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' },
        0
      );

      if (!prefersReducedMotion()) {
        // Sheet panel slides up from bottom (mobile) / fades + scales in (desktop)
        tl.fromTo(
          root.current.querySelector('.sheet-panel'),
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' },
          0.05
        );

        // Cover: FLIP-style grow from origin rect
        if (originRect && cover.current) {
          const to = cover.current.getBoundingClientRect();
          const scaleX = originRect.width / to.width;
          const scaleY = originRect.height / to.height;
          const dx = originRect.left + originRect.width / 2 - (to.left + to.width / 2);
          const dy = originRect.top + originRect.height / 2 - (to.top + to.height / 2);

          tl.from(
            cover.current,
            {
              x: dx,
              y: dy,
              scaleX,
              scaleY,
              duration: 0.55,
              ease: 'power3.out',
            },
            0.05
          );
        } else {
          tl.fromTo(
            cover.current,
            { opacity: 0, scale: 0.88, y: 20 },
            { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power3.out' },
            0.05
          );
        }

        // Sheet lines stagger up
        tl.fromTo(
          root.current.querySelectorAll('.sheet-line'),
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.07 },
          0.2
        );
      } else {
        // Reduced motion: plain fade
        tl.fromTo(
          root.current.querySelector('.sheet-panel'),
          { opacity: 0 },
          { opacity: 1, duration: 0.3, ease: 'power1.out' },
          0.05
        );
      }

      tl.play();
    }, root);

    // Focus the close button
    closeBtn.current?.focus();

    return () => {
      ctx.revert();
      document.body.style.overflow = '';
    };
  }, [originRect]);

  const handleBackdropClick = (e) => {
    if (e.target === backdrop.current) close();
  };

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={book.title}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      className="sm:items-center"
    >
      {/* Backdrop */}
      <div
        ref={backdrop}
        onClick={handleBackdropClick}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(29, 27, 24, 0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet panel */}
      <div
        className="sheet-panel"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 540,
          background: 'var(--background)',
          boxShadow: '0 -8px 40px rgba(40,25,10,.28)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90dvh',
          overflowY: 'auto',
        }}
      >
        {/* Close button */}
        <button
          ref={closeBtn}
          type="button"
          onClick={close}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            width: 44,
            height: 44,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--foreground-tertiary)',
            fontSize: 22,
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            zIndex: 3,
          }}
        >
          ×
        </button>

        <div style={{ display: 'flex', gap: 24, padding: '32px 24px 24px' }}>
          {/* Cover */}
          <div
            ref={cover}
            style={{
              flexShrink: 0,
              width: 160,
              aspectRatio: '2 / 3',
              position: 'relative',
              transformOrigin: 'center center',
            }}
          >
            <CoverFace book={book} />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            <h2
              className="sheet-line"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                fontWeight: 500,
                lineHeight: 1.2,
                color: 'var(--foreground)',
                margin: 0,
              }}
            >
              {book.title}
            </h2>

            <p
              className="sheet-line"
              style={{ fontFamily: 'var(--font-accent)', fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--foreground-secondary)', margin: 0 }}
            >
              {book.author}
            </p>

            {(book.reader_count > 0) && (
              <p
                className="sheet-line"
                style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--foreground-tertiary)', margin: 0 }}
              >
                {book.reader_count} {book.reader_count === 1 ? 'reader' : 'readers'}
              </p>
            )}

            {(book.tags || []).length > 0 && (
              <div
                className="sheet-line"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}
              >
                {(book.tags || []).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 11,
                      color: 'var(--foreground-tertiary)',
                      border: '1px solid currentColor',
                      padding: '2px 8px',
                      textTransform: 'capitalize',
                      opacity: 0.8,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action row */}
        <div
          className="sheet-line"
          style={{
            padding: '0 24px 20px',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {saved ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                color: 'var(--color-moss)',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-moss)', display: 'inline-block' }} />
              On your list
            </span>
          ) : (
            <button
              onClick={() => onSave?.(book)}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                background: 'var(--color-moss)',
                color: '#F5F1E8',
                border: 'none',
                padding: '10px 20px',
                cursor: 'pointer',
                letterSpacing: '.04em',
              }}
            >
              Want to read
            </button>
          )}
        </div>

        {/* Note */}
        {book.description && (
          <p
            className="sheet-line"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 15,
              lineHeight: 1.65,
              color: 'var(--foreground-secondary)',
              padding: '0 24px 28px',
              margin: 0,
              borderTop: '1px solid var(--border)',
              paddingTop: 16,
            }}
          >
            {book.description}
          </p>
        )}
      </div>
    </div>
  );
}

