export function CoverFace({ book }) {
  const art = book.art;
  if (book.cover && book.cover !== 'null') {
    return <img src={book.cover} alt="" className="cover-img" />;
  }

  return (
    <span className="cover" style={{ background: art.color, color: art.ink }}>
      <span className="cover-border" />
      <span className="cover-title">{book.title}</span>
      <span className="cover-author">{book.author}</span>
    </span>
  );
}
