import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Books, MagnifyingGlass, BookOpen, Check } from '@phosphor-icons/react';
import { db, seedMockData } from '../services/db';
import BookCard from '../components/BookCard';
import Navigation from '../components/Navigation';
import gsap from 'gsap';

export default function LibraryDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const dashboardRef = useRef(null);

  // Seed mock data once on mount
  useEffect(() => {
    seedMockData();
  }, []);

  // Entrance animation for dashboard elements
  useEffect(() => {
    if (!dashboardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(dashboardRef.current, 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
      );
    });
    return () => ctx.revert();
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

  const statusFilters = [
    { value: 'all', label: 'All Collection' },
    { value: 'reading', label: 'Currently Reading' },
    { value: 'wantToRead', label: 'Want to Read' },
    { value: 'completed', label: 'Finished' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-indigo/20 lg:pl-64 pb-28 lg:pb-12">
      {/* Shared Responsive Sidebar/Bottom-Bar Nav */}
      <Navigation />

      {/* Main Page Sandbox */}
      <div ref={dashboardRef} className="container mx-auto px-6 py-8 lg:px-12 max-w-7xl">
        
        {/* Page Hero Header */}
        <header className="flex flex-col gap-4 py-6 border-b border-foreground-tertiary/10 mb-8">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-accent uppercase tracking-widest text-foreground-tertiary">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
          
          <h1 className="text-5xl font-serif font-normal text-foreground leading-tight">
            Your Quiet Library
          </h1>
          
          <p className="text-foreground-secondary font-sans text-base max-w-md">
            A visual, tactile collection of stories, thoughts, and reading journeys.
          </p>
        </header>

        {/* Tactical Statistics Section */}
        <section className="grid grid-cols-3 gap-6 p-6 bg-background-secondary rounded-none border border-foreground-tertiary/10 mb-10">
          <div className="text-center space-y-1.5 border-r border-foreground-tertiary/10">
            <p className="text-3xl font-serif font-normal text-foreground">{stats.total}</p>
            <p className="text-xs font-accent text-foreground-tertiary uppercase tracking-wider">Volumes Collected</p>
          </div>
          <div className="text-center space-y-1.5 border-r border-foreground-tertiary/10">
            <p className="text-3xl font-serif font-normal text-moss">{stats.reading}</p>
            <p className="text-xs font-accent text-foreground-tertiary uppercase tracking-wider">Currently Reading</p>
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-3xl font-serif font-normal text-clay">{stats.completed}</p>
            <p className="text-xs font-accent text-foreground-tertiary uppercase tracking-wider">Completed</p>
          </div>
        </section>

        {/* Custom Search bar & Format Controls */}
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Muted Translucent Search Bar */}
          <div className="relative w-full max-w-md">
            <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-tertiary" size={18} weight="thin" />
            <input 
              type="text" 
              placeholder="Search your quiet collection…" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-none border border-foreground-tertiary/20 bg-background-secondary/50 backdrop-blur py-3 pl-12 pr-4 text-sm font-sans outline-none transition duration-200 placeholder:text-foreground-tertiary/60 focus:border-indigo focus:bg-background"
            />
          </div>

          {/* Ebook vs Physical Selectors */}
          <div className="flex gap-2">
            {['all', 'ebook', 'physical'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-5 py-2 text-xs font-sans font-medium uppercase tracking-wider rounded-none border transition duration-300 ${
                  filterType === type 
                    ? 'border-indigo bg-indigo text-background' 
                    : 'border-foreground-tertiary/20 bg-transparent text-foreground hover:bg-background-secondary hover:border-indigo'
                }`}
              >
                {type === 'all' ? 'All Formats' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Editorial Tab Status Filter */}
        <div className="border-b border-foreground-tertiary/10 mb-8 overflow-x-auto scrollbar-none">
          <div className="flex gap-8 whitespace-nowrap min-w-max pb-px">
            {statusFilters.map((tab) => {
              const isActive = filterStatus === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilterStatus(tab.value)}
                  className={`text-base font-sans font-medium pb-3 transition-colors duration-300 relative rounded-none border-b-2 ${
                    isActive 
                      ? 'border-moss text-foreground font-semibold' 
                      : 'border-transparent text-foreground-tertiary hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Grid View */}
        {books === undefined ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-none border-2 border-indigo border-r-transparent"></div>
          </div>
        ) : books.length === 0 ? (
          <div className="flex min-h-[350px] flex-col items-center justify-center rounded-none border border-dashed border-foreground-tertiary/30 bg-background-secondary/30 text-center p-8">
            <Books size={48} weight="thin" className="mb-4 text-foreground-tertiary/40" />
            <h3 className="text-xl font-serif text-foreground-secondary">Your shelf awaits its first story.</h3>
            <p className="mb-6 mt-2 text-sm text-foreground-tertiary max-w-sm">
              Browse your collection or add a new volume to begin your reading log.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
            {books.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
