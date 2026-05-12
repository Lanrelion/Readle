import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ArrowLeft, BookOpen, Calendar, CheckCircle2, Clock, ExternalLink, Hash, Info, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const book = useLiveQuery(() => db.books.get(id), [id]);
  const quotes = useLiveQuery(() => db.quotes.where('bookId').equals(id).toArray(), [id]);

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this book? All associated quotes will also be removed.')) {
      setIsDeleting(true);
      await db.books.delete(id);
      await db.quotes.where('bookId').equals(id).delete();
      navigate('/');
    }
  };

  if (book === undefined) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
    </div>
  );

  if (!book) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h2 className="text-xl font-semibold">Book not found</h2>
      <p className="text-muted-foreground">The book you're looking for doesn't exist in your local library.</p>
      <button onClick={() => navigate('/')} className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">Back to Library</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-border/60 bg-background/80 px-6 py-5 backdrop-blur-md lg:px-12">
        <div className="container mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="rounded-full p-2.5 hover:bg-muted/50 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <button onClick={handleDelete} className="rounded-full p-2.5 text-vermillion hover:bg-vermillion/10 transition-colors">
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 lg:px-12">
        <div className="flex flex-col gap-10 md:flex-row lg:gap-14">
          {/* Cover Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full md:w-1/3"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-[32px] bg-muted/30 shadow-2xl">
              {book.cover ? (
                <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-muted/50 p-8 text-center">
                  <span className="text-3xl font-serif font-bold text-foreground/80">{book.title}</span>
                  <span className="mt-4 text-sm text-muted-foreground">{book.author}</span>
                </div>
              )}
            </div>
            
            {book.type === 'ebook' && book.fileBlob && (
              <Link 
                to={`/reader/${book.id}`}
                className="mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-primary py-4 text-[15px] font-semibold text-primary-foreground shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <BookOpen size={20} />
                Continue Reading
              </Link>
            )}
          </motion.div>

          {/* Info Section */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 space-y-10"
          >
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider ${book.type === 'ebook' ? 'bg-[#E3E9F1] text-[#4A5B7A]' : 'bg-[#F1EBE3] text-[#5A534D]'}`}>
                  {book.type}
                </span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
                <span className="text-sm font-medium text-muted-foreground">
                  {book.status === 'reading' ? 'Currently Reading' : book.status === 'completed' ? 'Completed' : 'Want to Read'}
                </span>
              </div>
              <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight lg:text-5xl">{book.title}</h1>
              <p className="mt-4 text-xl font-medium text-muted-foreground">{book.author}</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="mb-2 text-muted-foreground"><Clock size={18} /></div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Progress</div>
                <div className="mt-1 text-lg font-semibold">
                  {book.progress?.type === 'percentage' ? `${book.progress.value}%` : book.progress?.value || '0%'}
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="mb-2 text-muted-foreground"><Calendar size={18} /></div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Added</div>
                <div className="mt-1 text-lg font-semibold">{new Date(book.dateAdded).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
              </div>
              <div className="hidden rounded-2xl border border-border/60 bg-muted/20 p-4 sm:block">
                <div className="mb-2 text-muted-foreground"><Hash size={18} /></div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ISBN</div>
                <div className="mt-1 text-lg font-semibold truncate" title={book.isbn}>{book.isbn || 'N/A'}</div>
              </div>
            </div>

            {/* Quotes Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <h2 className="text-xl font-bold tracking-tight">Saved Quotes</h2>
                <Link to="/quotes" className="text-sm font-medium text-primary hover:underline">View All</Link>
              </div>
              
              {quotes?.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
                  <p className="text-sm text-muted-foreground">No quotes saved for this book yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quotes?.slice(0, 3).map((q) => (
                    <motion.div 
                      key={q.id}
                      whileHover={{ x: 4 }}
                      className="rounded-2xl bg-muted/20 p-6 italic text-foreground/90 font-serif"
                    >
                      "{q.text}"
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
