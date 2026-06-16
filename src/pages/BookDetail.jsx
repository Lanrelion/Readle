import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Trash, PencilSimple, CheckCircle, BookOpen } from '@phosphor-icons/react';
import { db, deleteBook, deleteQuote, saveBookProgress } from '../services/db';
import Navigation from '../components/Navigation';
import { fullSync } from '../services/syncService';
import { supabase } from '../services/supabase';
import gsap from 'gsap';

// Helper
function formatRelativeTime(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function NotesTab({ book, onDelete }) {
  const [notes, setNotes] = useState(book.notes || '');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimerRef = useRef(null);
  const isEditingRef = useRef(false);

  // Sync notes from book prop when not actively editing
  // (e.g. if notes were updated from another device/tab)
  useEffect(() => {
    if (!isEditingRef.current) {
      setNotes(book.notes || '');
    }
  }, [book.notes]);

  // Auto-save notes 1.5 seconds after user stops typing
  const handleNotesChange = (e) => {
    const value = e.target.value;
    isEditingRef.current = true;
    setNotes(value);

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new timer to save
    saveTimerRef.current = setTimeout(async () => {
      await saveNotes(value);
      isEditingRef.current = false;
    }, 1500);
  };

  const saveNotes = async (notesValue) => {
    setSaving(true);
    try {
      // Save to IndexedDB
      await db.books.update(book.id, { notes: notesValue, synced: 0 }); // mark unsynced just in case full sync runs

      // Sync to Supabase if signed in
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('books')
          .update({ 
            notes: notesValue,
            // the user prompt included updating metadata as well, so we keep it to prevent data loss if they rely on it
            metadata: { ...(book.metadata || {}), notes: notesValue }
          })
          .eq('id', book.id);
          
        await db.books.update(book.id, { synced: 1 });
      }

      setLastSaved(new Date());
      console.log('[Notes] Auto-saved');
    } catch (error) {
      console.error('[Notes] Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-4 text-foreground-secondary font-sans leading-relaxed text-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-accent text-foreground-tertiary tracking-widest uppercase">
          Personal Notes
        </h3>
        <span className="text-xs text-foreground-tertiary">
          {saving
            ? 'Saving...'
            : lastSaved
            ? `Saved ${formatRelativeTime(lastSaved)}`
            : ''}
        </span>
      </div>

      <textarea
        value={notes}
        onChange={handleNotesChange}
        placeholder="Write your thoughts, character notes, favourite moments, or reading log entries for this book..."
        rows={12}
        className="
          w-full px-4 py-3
          bg-background border border-foreground-tertiary/20
          rounded-none
          text-foreground text-sm font-sans leading-relaxed
          placeholder-foreground-tertiary/50
          resize-none
          focus:outline-none focus:border-indigo
          transition duration-200
        "
      />

      <div className="pt-2 flex justify-between items-center">
        <p className="text-xs text-foreground-tertiary">
          Notes are private and saved automatically as you type.
        </p>
        <button 
          onClick={onDelete}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-vermillion border border-vermillion/20 hover:bg-vermillion hover:text-background transition duration-300 rounded-none"
        >
          <Trash size={14} weight="thin" />
          Delete Volume
        </button>
      </div>
    </div>
  );
}

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [newProgress, setNewProgress] = useState('');
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [quoteColor, setQuoteColor] = useState('#F5F1E8'); // Default Rice Paper
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'quotes' | 'chapters'

  const detailContainer = useRef(null);
  const bookCover = useRef(null);
  const metadata = useRef(null);

  const book = useLiveQuery(() => db.books.get(id), [id]);
  const quotes = useLiveQuery(async () => {
    const bookQuotes = await db.quotes.where('bookId').equals(id).toArray();
    return bookQuotes.sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved));
  }, [id]);

  const hasAnimated = useRef(false);

  // Premium Cinematic GSAP Book-Opening Transition — runs once on first render
  useEffect(() => {
    if (!book || !detailContainer.current || !bookCover.current || !metadata.current) return;
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    
    const ctx = gsap.context(() => {
      gsap.timeline()
        .fromTo(detailContainer.current, 
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }, 0)
        .fromTo(bookCover.current, 
          { rotateY: 25, x: 40, opacity: 0 },
          { rotateY: 0, x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 0)
        .fromTo(metadata.current, 
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.2);
    });
    
    return () => ctx.revert();
  }, [book]);

  if (book === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-none border-2 border-indigo border-r-transparent"></div>
      </div>
    );
  }
  
  if (book === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-serif font-normal text-foreground">Book not found</h2>
          <button 
            onClick={() => navigate('/')} 
            className="px-6 py-2.5 bg-indigo text-white text-sm font-medium rounded-none hover:bg-clay transition duration-300"
          >
            Return to Library
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadgeStyle = (status) => {
    switch(status) {
      case 'reading': return 'bg-moss text-background';
      case 'completed': return 'bg-clay text-background';
      case 'wantToRead': return 'bg-foreground-tertiary/20 text-foreground';
      default: return 'bg-foreground-tertiary/20 text-foreground';
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'reading': return 'Reading';
      case 'completed': return 'Completed';
      case 'wantToRead': return 'Want to Read';
      default: return status;
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this book?')) {
      await deleteBook(id);
      fullSync().catch(err => console.warn('[Sync] Immediate sync failed:', err));
      navigate('/');
    }
  };

  const handleMarkCompleted = async () => {
    const hasTotalPages = !!book.metadata?.totalPages;
    const currentProgressType = book.progress?.type || (hasTotalPages ? 'pages' : 'percentage');
    
    const completedValue = currentProgressType === 'percentage' ? 100 : `${book.metadata?.totalPages || '?'}/${book.metadata?.totalPages || '?'}`;
    
    await db.books.update(id, {
      status: 'completed',
      dateCompleted: new Date().toISOString(),
      progress: { 
        ...book.progress,
        type: currentProgressType, 
        value: completedValue
      },
      updatedAt: new Date().toISOString(),
      synced: 0
    });

    // [Bug 13] Also write to ebookProgress table so it syncs to Supabase
    const totalPages = book.metadata?.totalPages || null;
    await saveBookProgress(id, {
      currentPage: totalPages,
      totalPages: totalPages,
      percentageRead: 100,
    });

    fullSync().catch(err => console.warn('[Sync] Immediate sync failed:', err));
  };

  const handleUpdateProgress = async () => {
    const hasTotalPages = !!book.metadata?.totalPages;
    const currentProgressType = book.progress?.type || (hasTotalPages ? 'pages' : 'percentage');
    const isPercent = currentProgressType === 'percentage';

    const numericProgress = parseInt(newProgress) || 0;
    const formattedVal = isPercent
      ? Math.min(100, Math.max(0, numericProgress))
      : `${newProgress}/${book.metadata?.totalPages}`;

    await db.books.update(id, {
      progress: { 
        ...book.progress, 
        type: currentProgressType, 
        value: formattedVal 
      },
      status: 'reading',
      updatedAt: new Date().toISOString(),
      synced: 0
    });

    // [Bug 13] Also write to ebookProgress table so it syncs to Supabase
    const totalPages = book.metadata?.totalPages || null;
    const currentPage = isPercent ? null : numericProgress;
    const percentage = isPercent
      ? numericProgress
      : (totalPages ? Math.round((numericProgress / totalPages) * 100) : 0);

    await saveBookProgress(id, {
      currentPage: currentPage,
      totalPages: totalPages,
      percentageRead: percentage,
    });

    fullSync().catch(err => console.warn('[Sync] Immediate sync failed:', err));
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
      dateSaved: new Date().toISOString(),
      synced: 0
    });
    fullSync().catch(err => console.warn('[Sync] Immediate sync failed:', err));
    
    // Save Quote Toast notification via GSAP could go here
    setQuoteText('');
    setShowQuoteForm(false);
  };

  const handleDeleteQuote = async (quoteId) => {
    if (confirm('Delete this quote?')) {
      await deleteQuote(quoteId);
      fullSync().catch(err => console.warn('[Sync] Immediate sync failed:', err));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-indigo/20 lg:pl-64 pb-28 lg:pb-12">
      {/* Sidebar/Bottom Navigation */}
      <Navigation />

      {/* Hero Cover Backdrop Section */}
      <div className="relative h-96 w-full overflow-hidden bg-background-tertiary">
        {book.cover ? (
          <>
            <img src={book.cover} alt="" className="w-full h-full object-cover opacity-20 blur-md scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo/5 to-background-tertiary/20" />
        )}
        <div className="absolute bottom-6 left-6 lg:left-12 flex items-center gap-4 z-10">
          <button 
            onClick={() => navigate('/')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-none bg-background-secondary/80 backdrop-blur border border-foreground-tertiary/20 text-foreground hover:bg-background transition duration-300"
            aria-label="Go back"
          >
            <ArrowLeft size={20} weight="thin" />
          </button>
        </div>
      </div>

      {/* Details Container */}
      <main ref={detailContainer} className="container mx-auto px-6 -mt-32 lg:-mt-48 lg:px-12 max-w-5xl relative z-20">
        <div className="flex flex-col md:flex-row gap-10 lg:gap-14">
          
          {/* Main Cover Sidebar Cover Image */}
          <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
            <div 
              ref={bookCover}
              className="aspect-[3/4] w-full overflow-hidden rounded-none border border-foreground-tertiary/20 bg-background-secondary shadow-xl relative"
            >
              {book.cover ? (
                <img src={book.cover} alt={`Cover of ${book.title}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-background-secondary">
                  <span className="text-xl font-serif font-normal text-foreground line-clamp-4 leading-snug">{book.title}</span>
                  <span className="mt-4 text-[10px] font-accent text-foreground-tertiary uppercase tracking-widest line-clamp-2">{book.author}</span>
                </div>
              )}
            </div>
            
            {/* Ebook/PDF Read CTA or File Attached States */}
            {(book.type === 'ebook' || book.type === 'pdf') && (
              book.fileBlob ? (
                <button 
                  onClick={() => navigate(`/read/${book.id}`)}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-none bg-indigo px-6 py-3.5 text-base font-sans font-medium text-background shadow-md transition duration-300 hover:bg-clay active:scale-95"
                >
                  <BookOpen size={18} weight="thin" />
                  Continue Reading
                </button>
              ) : (
                <button 
                  disabled
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-none bg-background-secondary/50 px-6 py-3.5 text-base font-sans font-medium text-foreground-tertiary border border-foreground-tertiary/25 cursor-not-allowed"
                >
                  <BookOpen size={18} weight="thin" />
                  No File Attached
                </button>
              )
            )}
          </div>

          {/* Details & Actions Dashboard Layout */}
          <div ref={metadata} className="flex-1 space-y-10">
            
            {/* Literary Header */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`px-3 py-0.5 text-[11px] font-accent uppercase tracking-widest ${getStatusBadgeStyle(book.status)}`}>
                  {getStatusLabel(book.status)}
                </span>
                <span className="px-3 py-0.5 text-[11px] font-accent uppercase tracking-widest bg-background-secondary border border-foreground-tertiary/20 text-foreground-secondary">
                  {book.type === 'ebook' ? 'Ebook' : book.type === 'pdf' ? 'PDF' : 'Physical'}
                </span>
              </div>
              <h2 className="text-4xl font-serif font-normal text-foreground leading-snug">{book.title}</h2>
              <p className="text-lg text-foreground-secondary font-sans mt-1">{book.author}</p>
            </div>

            {/* Editorial Metadata Stack Grid */}
            <div className="grid grid-cols-2 gap-6 rounded-none border border-foreground-tertiary/20 bg-background-secondary p-6">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-foreground-tertiary mb-1 font-accent">Added On</p>
                <p className="text-base text-foreground font-sans">{new Date(book.dateAdded).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-foreground-tertiary mb-1 font-accent">ISBN</p>
                <p className="text-base text-foreground font-sans">{book.isbn || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-foreground-tertiary mb-1 font-accent">Total Pages</p>
                <p className="text-base text-foreground font-sans">{book.metadata?.totalPages || 'Unknown'}</p>
              </div>
              {book.dateCompleted && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-foreground-tertiary mb-1 font-accent">Completed On</p>
                  <p className="text-base text-foreground font-sans">{new Date(book.dateCompleted).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {/* Reading Progress Container */}
            {book.status !== 'completed' && (
              <div className="rounded-none border border-foreground-tertiary/25 bg-background-secondary p-8 space-y-6">
                <div className="flex justify-between items-baseline">
                  <h3 className="text-sm uppercase tracking-widest text-foreground-tertiary font-accent">Reading Progress</h3>
                  <span className="text-xs font-accent text-foreground-tertiary">
                    {book.progress?.type === 'percentage' 
                      ? `${book.progress?.value || 0}%` 
                      : (book.progress?.value ? `${book.progress.value}` : '0%')}
                  </span>
                </div>
                
                {isEditingProgress ? (
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      value={newProgress}
                      onChange={(e) => setNewProgress(e.target.value)}
                      placeholder={(book.progress?.type === 'percentage' || (!book.progress?.type && !book.metadata?.totalPages)) ? '%' : 'Page #'}
                      className="w-24 rounded-none border border-foreground-tertiary/30 bg-background px-4 py-2.5 text-sm font-sans outline-none focus:border-indigo" 
                    />
                    <span className="text-sm text-foreground-secondary font-sans">
                      {(book.progress?.type === 'percentage' || (!book.progress?.type && !book.metadata?.totalPages)) ? '% Read' : `/ ${book.metadata?.totalPages || '?'}`}
                    </span>
                    <button 
                      onClick={handleUpdateProgress}
                      className="ml-auto rounded-none bg-indigo px-5 py-2.5 text-sm font-sans font-medium text-background hover:bg-clay transition duration-300"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setIsEditingProgress(false)}
                      className="rounded-none border border-foreground-tertiary/30 px-5 py-2.5 text-sm font-sans font-medium text-foreground hover:bg-background-secondary transition duration-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Ink Brush Progress Bar */}
                    <div className="w-full h-1 bg-foreground-tertiary/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-moss transition-all duration-700 ease-in-out"
                        style={{ 
                          width: book.progress?.type === 'percentage' 
                            ? `${book.progress?.value || 0}%` 
                            : (book.progress?.value?.includes('/') 
                                ? `${(parseInt(book.progress.value.split('/')[0]) / (parseInt(book.progress.value.split('/')[1]) || 1)) * 100}%` 
                                : '0%') 
                        }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center pt-2">
                      <p className="text-xs text-foreground-secondary font-sans">
                        Position: {book.progress?.value || '0'}
                      </p>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setIsEditingProgress(true)}
                          className="inline-flex items-center gap-2 rounded-none border border-foreground-tertiary/30 bg-transparent px-4 py-2 text-xs font-sans font-medium text-foreground hover:bg-background transition duration-300"
                        >
                          <PencilSimple size={14} weight="thin" />
                          Update Progress
                        </button>
                        <button 
                          onClick={handleMarkCompleted}
                          className="inline-flex items-center gap-2 rounded-none bg-moss px-4 py-2 text-xs font-sans font-medium text-background hover:bg-clay transition duration-300"
                        >
                          <CheckCircle size={14} weight="thin" />
                          Finish Book
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Editorial Tabs Selection System */}
            <div className="border-t border-foreground-tertiary/20">
              <div className="flex gap-8 border-b border-foreground-tertiary/10 pb-px">
                <button 
                  onClick={() => setActiveTab('notes')}
                  className={`text-sm font-sans font-medium pb-2 border-b-2 transition duration-300 ${
                    activeTab === 'notes' ? 'border-indigo text-foreground font-semibold' : 'border-transparent text-foreground-tertiary hover:text-foreground'
                  }`}
                >
                  Notes & Details
                </button>
                <button 
                  onClick={() => setActiveTab('quotes')}
                  className={`text-sm font-sans font-medium pb-2 border-b-2 transition duration-300 ${
                    activeTab === 'quotes' ? 'border-indigo text-foreground font-semibold' : 'border-transparent text-foreground-tertiary hover:text-foreground'
                  }`}
                >
                  Quotes ({quotes?.length || 0})
                </button>
              </div>

              {/* Tab Frame Contents */}
              <div className="py-6">
                
                {/* Notes/Book details Tab */}
                {activeTab === 'notes' && (
                  <NotesTab book={book} onDelete={handleDelete} />
                )}

                {/* Quotes Collection Tab */}
                {activeTab === 'quotes' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-accent text-foreground-tertiary uppercase tracking-wider">Saved Passages</h4>
                      {!showQuoteForm && (
                        <button 
                          onClick={() => setShowQuoteForm(true)}
                          className="px-4 py-2 border border-foreground-tertiary/30 hover:bg-background-secondary text-xs font-medium rounded-none transition duration-300"
                        >
                          + Add Quote
                        </button>
                      )}
                    </div>

                    {showQuoteForm && (
                      <div className="p-6 rounded-none border border-foreground-tertiary/20 bg-background-secondary space-y-4">
                        <textarea 
                          value={quoteText}
                          onChange={(e) => setQuoteText(e.target.value)}
                          placeholder="Type a memorable quote here..."
                          className="w-full min-h-[100px] rounded-none border border-foreground-tertiary/30 bg-background px-4 py-3 text-sm font-serif italic outline-none focus:border-indigo resize-y"
                        />
                        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                          <div className="flex gap-2 items-center">
                            <span className="text-[11px] font-accent uppercase tracking-widest text-foreground-tertiary mr-1">Color</span>
                            {['#F5F1E8', '#E3E9F1', '#E8F1E3', '#F1E3E8', '#F1EBE3'].map(color => (
                              <button
                                key={color}
                                onClick={() => setQuoteColor(color)}
                                className={`w-6 h-6 rounded-full border-2 transition-transform ${quoteColor === color ? 'border-indigo scale-110' : 'border-transparent hover:scale-110'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => setShowQuoteForm(false)}
                              className="px-4 py-2 text-xs font-sans font-medium text-foreground-tertiary hover:text-foreground"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={handleSaveQuote}
                              className="px-5 py-2 bg-indigo text-background text-xs font-sans font-medium hover:bg-clay transition duration-300"
                            >
                              Save Quote
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {quotes === undefined ? (
                      <div className="py-10 flex justify-center"><div className="h-6 w-6 animate-spin rounded-none border-2 border-indigo border-r-transparent"></div></div>
                    ) : quotes.length === 0 && !showQuoteForm ? (
                      <div className="text-center py-10 border border-dashed border-foreground-tertiary/30 bg-background-secondary/20">
                        <p className="text-sm text-foreground-tertiary font-serif italic">"No quotes saved yet from this story."</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {quotes.map(quote => (
                          <div 
                            key={quote.id} 
                            className="relative group rounded-none p-6 shadow-sm border-l-4 border-moss border border-foreground-tertiary/10 transition duration-300 hover:shadow-md" 
                            style={{ 
                              backgroundColor: quote.color || '#EFE9DD',
                              borderLeftColor: quote.color === '#F5F1E8' ? '#66785F' : (quote.color === '#E3E9F1' ? '#4A5A73' : '#8A6A55')
                            }}
                          >
                            <p className="text-base font-serif italic text-foreground leading-relaxed pr-8">
                              "{quote.text}"
                            </p>
                            
                            <div className="flex justify-between items-baseline pt-4 mt-4 border-t border-foreground-tertiary/10">
                              <span className="text-[11px] font-accent text-foreground-tertiary uppercase tracking-wider">
                                Saved {new Date(quote.dateSaved).toLocaleDateString()}
                              </span>
                              <button 
                                onClick={() => handleDeleteQuote(quote.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-vermillion hover:bg-white/40 rounded-none"
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
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
