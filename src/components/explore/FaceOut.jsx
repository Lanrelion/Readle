import { useRef, useLayoutEffect } from 'react';
import { gsap, prefersReducedMotion } from '../../utils/gsapSetup';
import { CoverFace } from './CoverFace';
import { RecSeal } from './RecSeal';
import { CARD_H, CARD_W, HOVER_IN_MS, HOVER_OUT_MS, USE_3D_TURN } from './focusConfig';

export function FaceOut({ book, index = 0, onOpen, innerRef, reduce = false }) {
  const localRef = useRef(null);
  const ref = innerRef || localRef;
  const hoverInTimer = useRef(null);
  const hoverOutTimer = useRef(null);

  useLayoutEffect(() => {
    if (reduce || prefersReducedMotion() || !ref.current) return;
    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        opacity: 0,
        y: 40,
        rotateY: USE_3D_TURN ? 28 : 0,
        scale: 0.92,
        duration: 1,
        ease: 'power3.out',
        delay: index * 0.15,
      });
      gsap.to(ref.current, {
        y: '+=4',
        duration: 3 + index * 0.7,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: 1.2,
      });
    }, ref);
    return () => ctx.revert();
  }, [index, ref, reduce]);

  useLayoutEffect(() => () => {
    window.clearTimeout(hoverInTimer.current);
    window.clearTimeout(hoverOutTimer.current);
  }, []);

  const handlePointerEnter = () => {
    if (reduce || window.matchMedia('(hover: none)').matches || prefersReducedMotion() || !ref.current) return;
    window.clearTimeout(hoverOutTimer.current);
    window.clearTimeout(hoverInTimer.current);
    hoverInTimer.current = window.setTimeout(() => {
      gsap.to(ref.current, {
        ...(USE_3D_TURN ? { rotateY: 0 } : {}),
        scale: 1.05,
        duration: 0.4,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    }, HOVER_IN_MS);
  };

  const handlePointerLeave = () => {
    if (reduce || window.matchMedia('(hover: none)').matches || prefersReducedMotion() || !ref.current) return;
    window.clearTimeout(hoverInTimer.current);
    hoverOutTimer.current = window.setTimeout(() => {
      gsap.to(ref.current, { rotateY: 0, scale: 1, duration: HOVER_OUT_MS / 1000, ease: 'power2.out', overwrite: 'auto' });
    }, HOVER_OUT_MS);
  };

  return (
    <button
      ref={ref}
      className="faceout"
      style={{ '--card-w': `${CARD_W}px`, '--card-h': `${CARD_H}px` }}
      aria-label={`${book.title} by ${book.author}, recommended by ${book.recommendation_count} ${book.recommendation_count === 1 ? 'reader' : 'readers'}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handlePointerEnter}
      onBlur={handlePointerLeave}
      onClick={(e) => onOpen?.(book, e.currentTarget.getBoundingClientRect())}
    >
      <CoverFace book={book} />
      <RecSeal count={Number(book.recommendation_count) || 0} variant="cover" />
    </button>
  );
}
