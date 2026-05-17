import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Quotes, Trash, ArrowLeft } from '@phosphor-icons/react';
import { useNavigate, Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import gsap from 'gsap';

export default function QuotesList() {
  const navigate = useNavigate();
  const [selectedBookFilter, setSelectedBookFilter] = useState('all');
  const boardRef = useRef(null);

  const quotes = useLiveQuery(async () => {
    const allQuotes = await db.quotes.toArray();
    allQuotes.sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved));
    
    return Promise.all(allQuotes.map(async (q) => {
      const book = await db.books.get(q.bookId);
      return { ...q, bookTitle: book?.title || 'Unknown Book' };
    }));
  });

  // Unique books checklist from quotes for filtering
  const uniqueBooks = quotes
    ? Array.from(new Set(quotes.map(q => JSON.stringify({ id: q.bookId, title: q.bookTitle })))).map(s => JSON.parse(s))
    : [];

  // Staggered Entrance Animation for Quotes Grid Cards via GSAP
  useEffect(() => {
    if (!quotes || quotes.length === 0 || !boardRef.current) return;
    
    const ctx = gsap.context(() => {
      const cards = boardRef.current.querySelectorAll('.quote-card');
      gsap.fromTo(cards,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
      );
    }, boardRef);
    
    return () => ctx.revert();
  }, [quotes, selectedBookFilter]);

  const handleDelete = async (id) => {
    if (confirm('Delete this quote?')) {
      await db.quotes.delete(id);
    }
  };

  const filteredQuotes = quotes
    ? selectedBookFilter === 'all'
      ? quotes
      : quotes.filter(q => q.bookId === selectedBookFilter)
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-indigo/20 lg:pl-64 pb-28 lg:pb-12">
      {/* Responsive Sidebar Navigation */}
      <Navigation />

      {/* Main Container */}
      <div className="container mx-auto px-6 py-8 lg:px-12 max-w-6xl">
        
        {/* Literary Header */}
        <header className="flex flex-col gap-4 py-6 border-b border-foreground-tertiary/10 mb-8">
          <h1 className="text-5xl font-serif font-normal text-foreground leading-tight">Collected Thoughts</h1>
          <p className="text-foreground-secondary font-sans text-base max-w-md">Passages, insights, and dialogues that resonated.</p>
        </header>

        {/* Horizontal Editorial Filter Slider */}
        {uniqueBooks.length > 0 && (
          <div className="flex gap-3 mb-8 overflow-x-auto scrollbar-none pb-2">
            <button
              onClick={() => setSelectedBookFilter('all')}
              className={`px-4 py-2 text-xs font-sans font-medium uppercase tracking-wider rounded-none border transition duration-300 whitespace-nowrap ${
                selectedBookFilter === 'all'
                  ? 'border-indigo bg-indigo text-background'
                  : 'border-foreground-tertiary/30 bg-transparent text-foreground hover:bg-background-secondary hover:border-indigo'
              }`}
            >
              All Quotes
            </button>
            {uniqueBooks.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBookFilter(b.id)}
                className={`px-4 py-2 text-xs font-sans font-medium uppercase tracking-wider rounded-none border transition duration-300 whitespace-nowrap ${
                  selectedBookFilter === b.id
                    ? 'border-indigo bg-indigo text-background'
                    : 'border-foreground-tertiary/30 bg-transparent text-foreground hover:bg-background-secondary hover:border-indigo'
                }`}
              >
                {b.title}
              </button>
            ))}
          </div>
        )}

        {/* Grid Board */}
        {quotes === undefined ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-none border-2 border-indigo border-r-transparent"></div>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="flex min-h-[350px] flex-col items-center justify-center rounded-none border border-dashed border-foreground-tertiary/30 bg-background-secondary/30 text-center p-8">
            <Quotes size={48} weight="thin" className="mb-4 text-foreground-tertiary/30" />
            <h3 className="text-xl font-serif text-foreground-secondary">No quotes saved yet</h3>
            <p className="mb-4 mt-2 text-sm text-foreground-tertiary max-w-sm">
              Highlight sentences while reading digital books or add quotes from physical pages in details.
            </p>
          </div>
        ) : (
          <div ref={boardRef} className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {filteredQuotes.map((quote) => (
              <div
                key={quote.id}
                className="quote-card break-inside-avoid rounded-none p-6 shadow-sm relative group transition duration-300 hover:shadow-md border border-foreground-tertiary/10 border-l-4"
                style={{ 
                  backgroundColor: quote.color || '#EFE9DD',
                  borderLeftColor: quote.color === '#F5F1E8' ? '#66785F' : (quote.color === '#E3E9F1' ? '#4A5A73' : '#8A6A55')
                }}
              >
                <Quotes size={20} weight="thin" className="text-foreground-tertiary/30 mb-3" />
                <p className="text-base font-serif italic leading-relaxed text-foreground mb-4">
                  "{quote.text}"
                </p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-foreground-tertiary/10">
                  <Link 
                    to={`/book/${quote.bookId}`} 
                    className="text-[11px] font-accent uppercase tracking-wider text-foreground-secondary hover:underline line-clamp-1"
                  >
                    {quote.bookTitle}
                  </Link>
                  <button 
                    onClick={() => handleDelete(quote.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-vermillion hover:bg-white/40 rounded-none"
                    title="Delete Quote"
                  >
                    <Trash size={14} weight="thin" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
