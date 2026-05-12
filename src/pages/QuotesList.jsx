import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ArrowLeft, Quote, Trash2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function QuotesList() {
  const navigate = useNavigate();
  
  const quotes = useLiveQuery(async () => {
    const allQuotes = await db.quotes.toArray();
    // Sort by newest first
    allQuotes.sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved));
    
    // Fetch book details for each quote
    return Promise.all(allQuotes.map(async (q) => {
      const book = await db.books.get(q.bookId);
      return { ...q, bookTitle: book?.title || 'Unknown Book' };
    }));
  });

  const handleDelete = async (id) => {
    if (confirm('Delete this quote?')) {
      await db.quotes.delete(id);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 pb-12">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-5 lg:px-12 flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[28px] font-serif font-bold tracking-tight text-foreground">Saved Quotes</h1>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 lg:px-12 max-w-4xl">
        {quotes === undefined ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
          </div>
        ) : quotes.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex min-h-[400px] flex-col items-center justify-center rounded-[20px] border border-dashed border-border/60 bg-muted/10 text-center p-8"
          >
            <Quote size={48} className="mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-foreground">No quotes saved yet</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Save memorable quotes from the Book Detail pages.
            </p>
          </motion.div>
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            <AnimatePresence>
              {quotes.map((quote) => (
                <motion.div
                  key={quote.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`break-inside-avoid rounded-[20px] p-6 shadow-sm relative group transition-all duration-300 hover:shadow-md border border-border/10`}
                  style={{ backgroundColor: quote.color || '#F7F3ED' }}
                >
                  <Quote size={20} className="text-foreground/20 mb-3" />
                  <p className="text-[15px] font-serif leading-relaxed text-[#1F1A17] mb-4">
                    "{quote.text}"
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1F1A17]/10">
                    <Link to={`/book/${quote.bookId}`} className="text-[11px] font-medium uppercase tracking-widest text-[#5A534D] hover:underline line-clamp-1">
                      {quote.bookTitle}
                    </Link>
                    <button 
                      onClick={() => handleDelete(quote.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-vermillion hover:bg-white/30 rounded-full"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
