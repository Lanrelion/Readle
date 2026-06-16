import { Book, BookOpen, Check } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import gsap from 'gsap';

export default function BookCard({ book }) {
  const cardRef = useRef(null);

  const getStatusLabel = (status) => {
    switch(status) {
      case 'reading': return 'Reading';
      case 'completed': return 'Completed';
      case 'wantToRead': return 'Want to Read';
      default: return status;
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch(status) {
      case 'reading': 
        return 'bg-moss text-background'; 
      case 'completed': 
        return 'bg-clay text-background';
      case 'wantToRead': 
        return 'bg-foreground-tertiary/20 text-foreground';
      default: 
        return 'bg-foreground-tertiary/20 text-foreground';
    }
  };

  const handleMouseEnter = () => {
    gsap.to(cardRef.current, {
      y: -4,
      boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
      duration: 0.3,
      ease: 'power2.inOut',
    });
  };

  const handleMouseLeave = () => {
    gsap.to(cardRef.current, {
      y: 0,
      boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)',
      duration: 0.3,
      ease: 'power2.inOut',
    });
  };

  const getPercentageValue = () => {
    if (!book.progress) return 0;
    if (book.progress.type === 'percentage') {
      return book.progress.value;
    }
    if (book.progress.type === 'pages' && typeof book.progress.value === 'string') {
      const parts = book.progress.value.split('/');
      if (parts.length === 2) {
        const current = parseInt(parts[0], 10);
        const total = parseInt(parts[1], 10);
        if (!isNaN(current) && !isNaN(total) && total > 0) {
          return Math.round((current / total) * 100);
        }
      }
    }
    return book.status === 'completed' ? 100 : 0;
  };

  return (
    <div 
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="h-full"
    >
      <Link 
        to={`/book/${book.id}`} 
        className="group flex h-full flex-col overflow-hidden rounded-none bg-background-secondary shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-shadow duration-300"
      >
        {/* Cover Image */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-background-tertiary/30 rounded-none">
          {book.cover && book.cover !== 'null' && (
            <img 
              src={book.cover} 
              alt={`Cover of ${book.title}`} 
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-102 absolute inset-0 z-10"
              onError={(e) => {
                e.target.style.display = 'none'; // hide broken image to reveal placeholder underneath
              }}
            />
          )}
          
          {/* Always render placeholder underneath as fallback */}
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-indigo/10 to-background-tertiary/40 p-4 text-center transition-transform duration-500 group-hover:scale-102 absolute inset-0 z-0">
            <span className="text-lg font-serif font-normal text-foreground/80 line-clamp-3 leading-snug">{book.title}</span>
            <span className="mt-2 text-[11px] font-accent text-foreground-secondary line-clamp-1">{book.author}</span>
          </div>
          
          {/* Status Badge Overlay */}
          <div className="absolute right-3 top-3">
            <span className={`px-3 py-1 text-xs font-medium rounded-none uppercase tracking-wider ${getStatusBadgeStyle(book.status)}`}>
              {getStatusLabel(book.status)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-3">
            <h3 className="line-clamp-1 font-serif text-lg font-normal tracking-tight text-foreground" title={book.title}>
              {book.title}
            </h3>
            <p className="line-clamp-1 text-sm text-foreground-secondary mt-0.5" title={book.author}>
              {book.author}
            </p>
          </div>

          {/* Status & Progress */}
          <div className="mt-auto pt-2">
            <div className="flex items-center gap-2 mb-2">
              {book.status === 'reading' && <BookOpen size={14} weight="thin" className="text-moss" />}
              {book.status === 'completed' && <Check size={14} weight="thin" className="text-clay" />}
              {book.status === 'wantToRead' && <Book size={14} weight="thin" className="text-foreground-tertiary" />}
              <span className="text-xs text-foreground-tertiary uppercase tracking-wider font-accent">
                {book.type === 'ebook' ? 'Ebook' : book.type === 'pdf' ? 'PDF' : 'Physical'}
              </span>
            </div>
            
            {(book.status === 'reading' || book.status === 'completed') && book.progress && (
              <div className="w-full mt-1">
                <div className="flex items-center justify-between text-[11px] text-foreground-tertiary mb-1.5 font-medium">
                  <span>Progress</span>
                  <span>
                    {book.progress.type === 'percentage' 
                      ? `${book.progress.value}%` 
                      : book.progress.value}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-foreground-tertiary/20">
                  <div 
                    className="h-full bg-moss transition-all duration-700 ease-out"
                    style={{ 
                      width: `${getPercentageValue()}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
