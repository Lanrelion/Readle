export function CoverFace({ book }) {
  const art = book.art;
  const hasCover = typeof book.cover === 'string'
    && book.cover.trim() !== ''
    && book.cover.trim().toLowerCase() !== 'null';

  return (
    <>
      <span className="cover" style={{ background: art.color, color: art.ink }}>
        <span className="cover-border" />
        <span className="cover-title">{book.title}</span>
        <span className="cover-author">{book.author}</span>
      </span>
      {hasCover && (
        <img
          src={book.cover}
          alt=""
          className="cover-img"
          style={{ position: 'absolute', inset: 0 }}
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      )}
    </>
  );
}
