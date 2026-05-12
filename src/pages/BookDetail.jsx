import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Trash2, Edit3, CheckCircle, BookOpen } from 'lucide-react';
import { db } from '../services/db';
import { motion } from 'framer-motion';

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [newProgress, setNewProgress] = useState('');
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [quoteColor, setQuoteColor] = useState('#F7F3ED'); // Default Rice Paper

  const book = useLiveQuery(() => db.books.get(id), [id]);
  const quotes = useLiveQuery(async () => {
    const bookQuotes = await db.quotes.where('bookId').equals(id).toArray();
    return bookQuotes.sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved));
  }, [id]);

  if (book === undefined) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
    </div>
  );
  
  if (book === null) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h2 className="text-xl font-medium text-foreground">Book not found</h2>
        <button onClick={() => navigate('/')} className="mt-4 text-sm text-primary hover:underline">Return to Library</button>
      </div>
    </div>
  );

  const getTagStyle = (tagValue) => {
    switch(tagValue) {
      case 'ebook': return 'bg-[#E3E9F1] text-[#4A5B7A] dark:bg-[#2A3445] dark:text-[#A8B7CD]';
      case 'physical': return 'bg-[#F1EBE3] text-[#5A534D] dark:bg-[#38312B] dark:text-[#B8AEA4]';
      case 'reading': return 'bg-[#E8F1E3] text-[#4B5E41] dark:bg-[#2D3A26] dark:text-[#A5BBA0]';
      case 'completed': return 'bg-[#F1E3E8] text-[#7A4A5E] dark:bg-[#452A36] dark:text-[#CDA8B9]';
      case 'wantToRead': return 'bg-[#EFEFEF] text-[#666666] dark:bg-[#333333] dark:text-[#AAAAAA]';
      default: return 'bg-[#F1EBE3] text-[#5A534D] dark:bg-[#38312B] dark:text-[#B8AEA4]';
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this book?')) {
      await db.books.delete(id);
      navigate('/');
    }
  };

  const handleMarkCompleted = async () => {
    await db.books.update(id, {
      status: 'completed',
      dateCompleted: new Date().toISOString(),
      progress: { 
        ...book.progress,
        type: book.progress?.type || 'pages', 
        value: book.progress?.type === 'percentage' ? 100 : `${book.metadata?.totalPages || '?'}/${book.metadata?.totalPages || '?'}` 
      }
    });
  };

  const handleUpdateProgress = async () => {
    const isPercent = book.progress?.type === 'percentage';
    let formattedVal = newProgress;
    
    if (isPercent) {
      formattedVal = Math.min(100, Math.max(0, parseInt(newProgress) || 0));
    } else {
      formattedVal = `${newProgress}/${book.metadata?.totalPages || '?'}`;
    }

    await db.books.update(id, {
      progress: { 
        ...book.progress, 
        type: book.progress?.type || 'pages', 
        value: formattedVal 
      },
      status: 'reading' // Auto-update status if updating progress
    });
    setIsEditingProgress(false);
    setNewProgress('');
  };

  const handleSaveQuote = async () => {
    if (!quoteText.trim()) return;
    await db.quotes.add({
      id: crypto.randomUUID(),
      bookId: id,
      text: quoteText.trim(),
      color: quoteColor,
      dateSaved: new Date().toISOString()
    });
    setQuoteText('');
    setShowQuoteForm(false);
  };

  const handleDeleteQuote = async (quoteId) => {
    if (confirm('Delete this quote?')) {
      await db.quotes.delete(quoteId);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 pb-12">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-5 lg:px-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-semibold tracking-tight text-foreground line-clamp-1">{book.title}</h1>
          </div>
          <button 
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-vermillion hover:bg-vermillion/10 transition-colors"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 lg:px-12 max-w-5xl">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row gap-10 lg:gap-14"
        >
          {/* Cover Sidebar */}
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
            <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20 shadow-sm">
              {book.cover ? (
                <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-muted/50 p-6 text-center">
                  <span className="text-xl font-bold tracking-tight text-foreground/80 line-clamp-4">{book.title}</span>
                  <span className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground line-clamp-2">{book.author}</span>
                </div>
              )}
            </div>
            
            {book.type === 'ebook' && (
              book.fileBlob ? (
                <button 
                  onClick={() => navigate(`/read/${book.id}`)}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#3B4A6B] px-[20px] py-[14px] text-[14px] font-medium text-[#FAF8F4] shadow-sm transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <BookOpen size={18} />
                  Read Ebook
                </button>
              ) : (
                <button 
                  disabled
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-muted/50 px-5 py-3 text-sm font-medium text-muted-foreground border border-border/50 cursor-not-allowed"
                  title="No EPUB file attached to this book"
                >
                  <BookOpen size={18} />
                  No File Attached
                </button>
              )
            )}
          </div>

          {/* Details & Actions */}
          <div className="flex-1 space-y-10">
            <div>
              <h2 className="text-4xl font-serif font-semibold tracking-tight text-foreground mb-2">{book.title}</h2>
              <p className="text-xl text-muted-foreground">{book.author}</p>
              
              <div className="mt-5 flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full px-[10px] py-[6px] text-[11px] font-medium uppercase tracking-widest ${getTagStyle(book.type)}`}>
                  {book.type}
                </span>
                <span className={`inline-flex items-center rounded-full px-[10px] py-[6px] text-[11px] font-medium uppercase tracking-widest ${getTagStyle(book.status)}`}>
                  {book.status === 'wantToRead' ? 'Want to Read' : book.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5 rounded-3xl border border-border/60 bg-card p-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Added On</p>
                <p className="font-medium text-sm text-foreground">{new Date(book.dateAdded).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">ISBN</p>
                <p className="font-medium text-sm text-foreground">{book.isbn || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Pages</p>
                <p className="font-medium text-sm text-foreground">{book.metadata?.totalPages || 'Unknown'}</p>
              </div>
              {book.dateCompleted && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Completed On</p>
                  <p className="font-medium text-sm text-foreground">{new Date(book.dateCompleted).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {/* Progress Section */}
            {book.status !== 'completed' && (
              <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-sm">
                <h3 className="text-lg font-medium mb-6">Reading Progress</h3>
                
                {isEditingProgress ? (
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      value={newProgress}
                      onChange={(e) => setNewProgress(e.target.value)}
                      placeholder={book.progress?.type === 'percentage' ? '%' : 'Page #'}
                      className="w-24 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:bg-background transition-colors" 
                    />
                    <span className="text-sm font-medium text-muted-foreground">
                      {book.progress?.type === 'percentage' ? '% Read' : `/ ${book.metadata?.totalPages || '?'}`}
                    </span>
                    <button 
                      onClick={handleUpdateProgress}
                      className="ml-auto rounded-full bg-[#3B4A6B] px-[20px] py-[10px] sm:py-[14px] text-[14px] font-medium text-[#FAF8F4] shadow-sm transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setIsEditingProgress(false)}
                      className="rounded-full border border-[#D8D0C7] dark:border-[#4E4741] bg-transparent px-[20px] py-[10px] sm:py-[14px] text-[14px] font-medium text-[#1F1A17] dark:text-[#F7F3ED] transition-all duration-300 ease-out hover:bg-muted/50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-semibold tracking-tight">
                        {book.progress?.type === 'percentage' ? `${book.progress?.value}%` : book.progress?.value || '0'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 font-medium">Current position</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsEditingProgress(true)}
                        className="inline-flex items-center gap-2 rounded-full border border-[#D8D0C7] dark:border-[#4E4741] bg-transparent px-[20px] py-[14px] text-[14px] font-medium text-[#1F1A17] dark:text-[#F7F3ED] transition-all duration-300 ease-out hover:bg-muted/50"
                      >
                        <Edit3 size={16} />
                        Update
                      </button>
                      <button 
                        onClick={handleMarkCompleted}
                        className="inline-flex items-center gap-2 rounded-full bg-matcha px-[20px] py-[14px] text-[14px] font-medium text-white shadow-sm transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
                      >
                        <CheckCircle size={16} />
                        Finish Book
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quotes Section */}
            <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium">Saved Quotes</h3>
                {!showQuoteForm && (
                  <button 
                    onClick={() => setShowQuoteForm(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#D8D0C7] dark:border-[#4E4741] bg-transparent px-[16px] py-[8px] text-[12px] font-medium text-[#1F1A17] dark:text-[#F7F3ED] transition-all duration-300 ease-out hover:bg-muted/50"
                  >
                    + Add Quote
                  </button>
                )}
              </div>

              {showQuoteForm && (
                <div className="mb-8 p-5 rounded-2xl border border-border/60 bg-muted/10">
                  <textarea 
                    value={quoteText}
                    onChange={(e) => setQuoteText(e.target.value)}
                    placeholder="Type a memorable quote here..."
                    className="w-full min-h-[100px] rounded-xl border border-border/60 bg-background px-4 py-3 text-sm font-serif outline-none transition-colors focus:border-primary/50 resize-y mb-4"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2 items-center">
                      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mr-2">Color</span>
                      {['#F7F3ED', '#E3E9F1', '#E8F1E3', '#F1E3E8', '#F1EBE3'].map(color => (
                        <button
                          key={color}
                          onClick={() => setQuoteColor(color)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${quoteColor === color ? 'border-primary scale-110' : 'border-transparent hover:scale-110'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowQuoteForm(false)}
                        className="rounded-full px-[16px] py-[8px] text-[12px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveQuote}
                        className="rounded-full bg-[#3B4A6B] px-[16px] py-[8px] text-[12px] font-medium text-[#FAF8F4] shadow-sm transition-all duration-300 hover:-translate-y-0.5"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {quotes === undefined ? (
                <div className="h-20 flex justify-center items-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-r-transparent"></div></div>
              ) : quotes.length === 0 && !showQuoteForm ? (
                <div className="text-center py-10 border border-dashed border-border/60 rounded-2xl bg-muted/5">
                  <p className="text-sm text-muted-foreground">No quotes saved yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quotes.map(quote => (
                    <div key={quote.id} className="relative group rounded-[16px] p-5 shadow-sm border border-border/10 transition-all hover:shadow-md" style={{ backgroundColor: quote.color || '#F7F3ED' }}>
                      <p className="text-[15px] font-serif leading-relaxed text-[#1F1A17] pr-8">
                        "{quote.text}"
                      </p>
                      <button 
                        onClick={() => handleDeleteQuote(quote.id)}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-vermillion hover:bg-white/40 rounded-full"
                        title="Delete Quote"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
