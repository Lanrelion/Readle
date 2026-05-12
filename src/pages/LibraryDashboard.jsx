import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedInitialData } from '../services/db';
import BookCard from '../components/BookCard';
import { Search, Plus, Library, SlidersHorizontal, Layers, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const CustomDropdown = ({ value, onChange, options, icon: Icon, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-4 py-2 text-sm font-medium transition-all hover:bg-muted/30"
      >
        <Icon size={16} className="text-muted-foreground" />
        <span>{selectedOption?.label}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-48 rounded-2xl border border-border/60 bg-card p-2 shadow-xl backdrop-blur-md">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => { onChange(option.value); setIsOpen(false); }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${value === option.value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function LibraryDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => { seedInitialData(); }, []);

  const books = useLiveQuery(async () => {
    let collection = db.books;
    let results = await collection.toArray();

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      results = results.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }

    if (filterStatus !== 'all') {
      results = results.filter(b => b.status === filterStatus);
    }

    if (filterType !== 'all') {
      results = results.filter(b => b.type === filterType);
    }

    return results;
  }, [searchQuery, filterStatus, filterType]);

  const stats = useLiveQuery(async () => {
    const all = await db.books.toArray();
    return {
      total: all.length,
      reading: all.filter(b => b.status === 'reading').length,
      completed: all.filter(b => b.status === 'completed').length
    };
  }, []) || { total: 0, reading: 0, completed: 0 };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Floating Action Button */}
      <Link to="/add-book" className="fixed bottom-8 right-8 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 lg:bottom-12 lg:right-12">
        <Plus size={32} />
      </Link>

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 px-6 py-8 backdrop-blur-md lg:px-12">
        <div className="container mx-auto flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Library size={24} />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">My Collection</span>
            </div>
            <h1 className="text-[32px] font-serif font-bold tracking-tight text-foreground lg:text-4xl">Readle Library</h1>
          </div>

          <div className="flex gap-8 border-t border-border/30 pt-6 lg:border-none lg:pt-0">
            <button 
              onClick={() => setFilterStatus('all')}
              className={`flex flex-col gap-1 text-left transition-opacity hover:opacity-70 ${filterStatus === 'all' ? 'opacity-100' : 'opacity-60'}`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${filterStatus === 'all' ? 'text-primary' : 'text-muted-foreground'}`}>Total Books</span>
              <span className={`text-2xl font-semibold ${filterStatus === 'all' ? 'text-primary' : 'text-foreground'}`}>{stats.total}</span>
            </button>
            <button 
              onClick={() => setFilterStatus('reading')}
              className={`flex flex-col gap-1 text-left transition-opacity hover:opacity-70 ${filterStatus === 'reading' ? 'opacity-100' : 'opacity-60'}`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${filterStatus === 'reading' ? 'text-[#6F7D60] dark:text-[#A5BBA0]' : 'text-muted-foreground'}`}>Reading</span>
              <span className={`text-2xl font-semibold ${filterStatus === 'reading' ? 'text-[#6F7D60] dark:text-[#A5BBA0]' : 'text-foreground'}`}>{stats.reading}</span>
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
