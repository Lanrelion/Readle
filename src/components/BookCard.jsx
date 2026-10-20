import { Book, BookOpen, Check } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import gsap from 'gsap';

const NEW_BOOK_REFERENCE_TIME = Date.now();

// Deterministic accent colour from title string
function titleToColor(title) {
  const colors = ['#66785F', '#8A6A55', '#4A5A73', '#C7A96B', '#5E574E'];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

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

  const isNew = () => {
    if (!book.dateAdded) return false;
    const daysSinceAdded = (NEW_BOOK_REFERENCE_TIME - new Date(book.dateAdded)) / (1000 * 60 * 60 * 24);
    return daysSinceAdded >= 0 && daysSinceAdded <= 7;
  };

  const hasCover = book.cover && book.cover !== 'null';

  return (
    <div 
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="h-full"
    >
      <Link 
        to={`/book/${book.id}`} 
        className="group flex h-full flex-col overflow-visible rounded-none bg-background-secondary shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-shadow duration-300"
      >
        {/* Cover Image */}
        <div className="relative aspect-[3/4] w-full overflow-visible bg-transparent rounded-none">
          {isNew() && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gold z-20" />
          )}

          {hasCover ? (
            <img
              src={book.cover}
              alt={`Cover of ${book.title}`}
              className="w-full aspect-[3/4] object-cover transition-all duration-300"
              style={{
                transform: 'rotate(-1deg)',
                boxShadow: '4px 8px 24px rgba(0,0,0,0.10)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'rotate(0deg) scale(1.02)';
                e.currentTarget.style.boxShadow = '8px 16px 32px rgba(0,0,0,0.16)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'rotate(-1deg)';
                e.currentTarget.style.boxShadow = '4px 8px 24px rgba(0,0,0,0.10)';
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div
              className="w-full aspect-[3/4] flex items-center justify-center transition-all duration-300"
              style={{
                backgroundColor: titleToColor(book.title),
                transform: 'rotate(-1deg)',
                boxShadow: '4px 8px 24px rgba(0,0,0,0.10)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'rotate(0deg) scale(1.02)';
                e.currentTarget.style.boxShadow = '8px 16px 32px rgba(0,0,0,0.16)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'rotate(-1deg)';
                e.currentTarget.style.boxShadow = '4px 8px 24px rgba(0,0,0,0.10)';
              }}
            >
              <span className="text-white font-serif text-4xl font-normal select-none">
                {book.title.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          {/* Status Badge Overlay */}
          <div className="absolute left-3 top-3 z-10">
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
              {book.status === 'reading' && <BookOpen size={16} weight="thin" className="text-moss" />}
              {book.status === 'completed' && <Check size={16} weight="thin" className="text-clay" />}
              {book.status === 'wantToRead' && <Book size={16} weight="thin" className="text-foreground-tertiary" />}
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
