import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Library, BookPlus, Sun, Moon, SlidersHorizontal, Layers, ChevronDown, Quote } from 'lucide-react';
import { db, seedMockData } from '../services/db';
import BookCard from '../components/BookCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const CustomDropdown = ({ value, onChange, options, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-10 w-full sm:w-[160px] items-center justify-between rounded-full border bg-muted/20 pl-10 pr-4 text-sm font-medium transition-all hover:bg-muted/30 focus:outline-none ${isOpen ? 'border-primary/50 ring-2 ring-primary/20' : 'border-border/60'}`}
      >
        <Icon className="absolute left-3.5 text-muted-foreground" size={16} />
        <span className="truncate text-foreground">{selected?.label}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 rounded-2xl border border-border/60 bg-card p-1.5 shadow-xl backdrop-blur-xl"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center rounded-xl px-3 py-2.5 text-sm transition-colors ${value === option.value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted/50'}`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function LibraryDashboard() {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Seed mock data once on mount
  useEffect(() => {
    seedMockData();
  }, []);

  // Reactive query to IndexedDB
  const books = useLiveQuery(
    async () => {
      let collection = db.books.toCollection();
      
      // Filter by type
      if (filterType !== 'all') {
        collection = db.books.where('type').equals(filterType);
      }
      
      let results = await collection.toArray();
      
      // Filter by status (in memory since we might have used the index for 'type')
      if (filterStatus !== 'all') {
        results = results.filter(b => b.status === filterStatus);
      }
      
      // Search by title or author
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        results = results.filter(b => 
          b.title.toLowerCase().includes(query) || 
          b.author.toLowerCase().includes(query)
        );
      }
      
      // Sort reading first, then newest
      return results.sort((a, b) => {
        if (a.status === 'reading' && b.status !== 'reading') return -1;
        if (b.status === 'reading' && a.status !== 'reading') return 1;
        return new Date(b.dateAdded) - new Date(a.dateAdded);
      });
    },
    [searchQuery, filterStatus, filterType],
    [] // Default value before loading
  );

  const stats = {
    total: books?.length || 0,
    reading: books?.filter(b => b.status === 'reading').length || 0,
    completed: books?.filter(b => b.status === 'completed').length || 0
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-5 lg:px-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <img src="/readle-logo.png" alt="Readle Logo" className="h-11 w-11 object-contain mix-blend-multiply dark:mix-blend-screen dark:invert" />
              <h1 className="text-[32px] font-serif font-bold tracking-tight text-foreground flex items-baseline">
                Readle<span className="text-vermillion">.</span>
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/quotes" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground" title="Saved Quotes">
                <Quote size={18} />
              </Link>
              <button 
                onClick={toggleTheme}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <Link to="/add" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#3B4A6B] px-[20px] py-[14px] text-[14px] font-medium text-[#FAF8F4] shadow-sm transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">
                <BookPlus size={18} />
                Add Book
              </Link>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-8 flex gap-8 text-sm">
            <button 
              onClick={() => setFilterStatus('all')}
              className={`flex flex-col gap-1 text-left transition-opacity hover:opacity-70 ${filterStatus === 'all' ? 'opacity-100' : 'opacity-60'}`}
            >
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total Books</span>
              <span className="text-2xl font-semibold text-foreground">{stats.total}</span>
            </button>
            <button 
              onClick={() => setFilterStatus('reading')}
              className={`flex flex-col gap-1 text-left transition-opacity hover:opacity-70 ${filterStatus === 'reading' ? 'opacity-100' : 'opacity-60'}`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${filterStatus === 'reading' ? 'text-[#4B5E41] dark:text-[#A5BBA0]' : 'text-muted-foreground'}`}>Reading</span>
              <span className={`text-2xl font-semibold ${filterStatus === 'reading' ? 'text-[#4B5E41] dark:text-[#A5BBA0]' : 'text-foreground'}`}>{stats.reading}</span>
            </button>
            <button 
              onClick={() => setFilterStatus('completed')}
              className={`flex flex-col gap-1 text-left transition-opacity hover:opacity-70 ${filterStatus === 'completed' ? 'opacity-100' : 'opacity-60'}`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${filterStatus === 'completed' ? 'text-[#3B4A6B] dark:text-[#A8B7CD]' : 'text-muted-foreground'}`}>Completed</span>
              <span className={`text-2xl font-semibold ${filterStatus === 'completed' ? 'text-[#3B4A6B] dark:text-[#A8B7CD]' : 'text-foreground'}`}>{stats.completed}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 lg:px-12">
        {/* Controls */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Search by title or author..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-border/60 bg-muted/20 py-2.5 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background"
            />
          </div>
          <div className="flex gap-3">
            <CustomDropdown 
              value={filterStatus}
              onChange={setFilterStatus}
              icon={SlidersHorizontal}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'reading', label: 'Reading' },
                { value: 'wantToRead', label: 'Want to Read' },
                { value: 'completed', label: 'Completed' }
              ]}
            />
            <CustomDropdown 
              value={filterType}
              onChange={setFilterType}
              icon={Layers}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'ebook', label: 'Ebooks' },
                { value: 'physical', label: 'Physical Books' }
              ]}
            />
          </div>
        </div>

        {/* Grid */}
        {books === undefined ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
          </div>
        ) : books.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 text-center"
          >
            <Library size={48} className="mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-foreground">No books found</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Try adjusting your filters or add a new book to your library.
            </p>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          >
            {books.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}
