import { useLayoutEffect, useRef, useState } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { gsap, prefersReducedMotion } from '../../utils/gsapSetup';
import { CoverFace } from './CoverFace';
import { CARD_W, CARD_H, CHIP_W, CHIP_GAP, USE_3D_TURN } from './focusConfig';

const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
const EDGE = 8;
const LIFT = -10;

export function FocusLayer({ roomRef, focus, mode, onOpen, onHold, onRelease }) {
  const cardRef = useRef(null);
  const chipRef = useRef(null);
  const [shown, setShown] = useState(null);

  useLayoutEffect(() => {
    const elements = [cardRef.current, chipRef.current].filter(Boolean);
    if (!focus) {
      if (elements.length) {
        const fade = gsap.to(elements, {
          opacity: 0,
          duration: 0.18,
          onComplete: () => setShown(null),
        });
        return () => fade.kill();
      }
      return;
    }

    const roomElement = roomRef.current;
    if (!roomElement || !focus.slotEl?.isConnected) return;
    const room = roomElement.getBoundingClientRect();
    const slot = focus.slotEl.getBoundingClientRect();
    const scale = parseFloat(getComputedStyle(roomElement).getPropertyValue('--s')) || 1;
    const width = CARD_W * scale;
    const height = CARD_H * scale;
    const centerX = slot.left + slot.width / 2 - room.left;
    const left = clamp(centerX - width / 2, EDGE, room.width - width - EDGE);
    const top = slot.bottom - 14 - room.top - height;
    const chipWidth = Math.min(CHIP_W, room.width - EDGE * 2);
    const chipLeft = clamp(left + width / 2 - chipWidth / 2, EDGE, room.width - chipWidth - EDGE);

    gsap.killTweensOf(elements);
    setShown({
      book: focus.book,
      geo: {
        left,
        top,
        width,
        height,
        chipWidth,
        chipLeft,
        dx: centerX - (left + width / 2),
        spineWidth: slot.width,
      },
    });
    return () => gsap.killTweensOf(elements);
  }, [focus, roomRef]);

  useLayoutEffect(() => {
    if (!shown) return;
    const card = cardRef.current;
    const chip = chipRef.current;
    const { geo } = shown;
    gsap.killTweensOf([card, chip]);

    if (prefersReducedMotion()) {
      gsap.fromTo([card, chip], { opacity: 0, y: LIFT }, { opacity: 1, y: LIFT, duration: 0.2 });
      return () => gsap.killTweensOf([card, chip]);
    }

    gsap.fromTo(
      card,
      {
        x: geo.dx,
        scaleX: geo.spineWidth / geo.width,
        rotateY: USE_3D_TURN ? -65 : 0,
        y: 0,
        opacity: 0.4,
        transformPerspective: 900,
        transformOrigin: '50% 100%',
      },
      { x: 0, scaleX: 1, rotateY: 0, y: LIFT, opacity: 1, duration: 0.5, ease: 'power3.out' }
    );
    gsap.fromTo(chip, { y: 8, opacity: 0 }, { y: LIFT, opacity: 1, duration: 0.35, delay: 0.12, ease: 'power2.out' });
    return () => gsap.killTweensOf([card, chip]);
  }, [shown]);

  if (!shown) return null;
  const { book, geo } = shown;
  const open = (element) => onOpen(book, element.getBoundingClientRect());
  const hold = {
    onPointerEnter: (event) => event.pointerType !== 'touch' && onHold(),
    onPointerLeave: (event) => event.pointerType !== 'touch' && onRelease(),
  };

  return (
    <div className="focus-layer" aria-hidden="true">
      <button
        ref={cardRef}
        tabIndex={-1}
        className="focus-card"
        style={{ left: geo.left, top: geo.top, width: geo.width, height: geo.height, pointerEvents: mode === 'scroll' ? 'none' : 'auto' }}
        onClick={(event) => open(event.currentTarget)}
        {...hold}
      >
        <CoverFace book={book} />
      </button>
      <div className="focus-anchor" style={{ left: geo.chipLeft, top: geo.top - CHIP_GAP, width: geo.chipWidth }}>
        <button ref={chipRef} tabIndex={-1} className="focus-chip" onClick={(event) => open(event.currentTarget)} {...hold}>
          <span className="chip-title">{book.title}</span>
          <span className="chip-author">{book.author}<CaretRight size={10} weight="thin" /></span>
        </button>
      </div>
    </div>
  );
}
