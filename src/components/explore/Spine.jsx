import { memo, useRef } from 'react';

export const Spine = memo(function Spine({ book, saved, isFocused, onEnter, onLeave, onKeyFocus, onActivate }) {
  const slotRef = useRef(null);
  const { art } = book;
  const label = `${book.title} by ${book.author}, ${book.reader_count} ${book.reader_count === 1 ? 'reader' : 'readers'}`;

  const onKeyDown = (event) => {
    const next = event.key === 'ArrowRight'
      ? slotRef.current?.nextElementSibling
      : event.key === 'ArrowLeft'
        ? slotRef.current?.previousElementSibling
        : null;
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <button
      ref={slotRef}
      className="spine-slot"
      data-key={book.key}
      data-focused={isFocused || undefined}
      aria-label={label}
      style={{ marginRight: art.leans ? 8 : 0 }}
      onPointerEnter={(event) => event.pointerType !== 'touch' && onEnter(book, slotRef.current)}
      onPointerLeave={(event) => event.pointerType !== 'touch' && onLeave()}
      onFocus={(event) => event.currentTarget.matches(':focus-visible') && onKeyFocus(book, slotRef.current)}
      onBlur={() => onLeave()}
      onKeyDown={onKeyDown}
      onClick={() => onActivate(book, slotRef.current)}
    >
      <span className={`spine-wrap${art.leans ? ' leans' : ''}`}>
        <span
          className="spine"
          style={{ width: art.width, height: `calc(var(--s) * ${art.height}px)`, background: art.color, color: art.ink }}
        >
          {art.ornament === 1 && (<><i className="band" style={{ top: 9 }} /><i className="band" style={{ bottom: 9 }} /></>)}
          {art.ornament === 2 && <i className="rule-double" />}
          {art.ornament === 3 && <i className="diamond" />}
          <span className="spine-title" aria-hidden="true">{book.title}</span>
          {art.width >= 46 && <span className="spine-author" aria-hidden="true">{book.author}</span>}
        </span>
        {book.reader_count >= 2 && <i className="ribbon" aria-hidden="true" />}
        {saved && <i className="saved-dot" aria-hidden="true" />}
      </span>
    </button>
  );
});
